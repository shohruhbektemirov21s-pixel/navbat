"""Private owner bot: explicitly allowlisted identities, no public login/onboarding."""
import html
from django.conf import settings
from django.db import transaction

from apps.authentication.models import User, UserRole, UserStatus
from apps.core.models import log_audit
from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus
from apps.marketplace.services import approve_business_application, reject_business_application

from .services import esc, telegram_api


def api(method, payload=None):
    return telegram_api(method, payload, token=settings.TELEGRAM_ADMIN_BOT_TOKEN)


def send(chat_id, text, keyboard=None):
    # Convert the small internal formatting vocabulary to plain text before
    # truncation, so a long rejection reason cannot break an HTML entity/tag.
    plain = html.unescape(text.replace('<b>', '').replace('</b>', ''))
    payload = {'chat_id': chat_id, 'text': plain[:4000]}
    if keyboard:
        payload['reply_markup'] = keyboard
    return api('sendMessage', payload)


def reviewer():
    return User.objects.filter(
        email__iexact=settings.TELEGRAM_ADMIN_REVIEWER_EMAIL,
        role=UserRole.FOUNDER, is_active=True, status=UserStatus.ACTIVE,
    ).first()


def card(chat_id, application):
    keyboard = {'inline_keyboard': [[
        {'text': 'Tasdiqlash', 'callback_data': f'approve:{application.id}'},
        {'text': 'Rad etish', 'callback_data': f'reject:{application.id}'},
    ]]}
    photos = application.photos.all()
    # Upload from disk: Telegram cannot fetch images hosted on localhost.
    import requests
    from .services import TELEGRAM_API
    for photo in photos[:6]:
        if not photo.image:
            continue
        try:
            with photo.image.open('rb') as file:
                requests.post(
                    TELEGRAM_API.format(token=settings.TELEGRAM_ADMIN_BOT_TOKEN, method='sendPhoto'),
                    data={'chat_id': chat_id}, files={'photo': file}, timeout=15,
                )
        except (OSError, requests.RequestException):
            pass  # The text card still allows review when a photo cannot be delivered.
    applicant = application.applicant
    # Plain text keeps long descriptions and user-supplied markup safe without
    # splitting an HTML entity/tag at Telegram's message length limit.
    details = '\n'.join([
        'YANGI BIZNES ARIZASI', f'Biznes: {application.name}',
        f'Soha: {application.category.name if application.category_id else "—"}',
        f'Viloyat: {application.region or (application.city.region if application.city_id else "—")}',
        f'Tuman/shahar: {application.district or (application.city.name if application.city_id else "—")}',
        f'Manzil: {application.address}', f'Telefon: {application.phone}',
        f'Arizachi: {applicant.name} · {applicant.email}' if applicant else f'Telegram: @{application.telegram_username}',
        'Ish vaqti: ' + ', '.join(f'{row.day_of_week}: {row.open_time}–{row.close_time}' for row in application.hours.all() if not row.is_closed),
        f'Tavsif: {application.description}',
    ])
    return api('sendMessage', {'chat_id': chat_id, 'text': details[:4000], 'reply_markup': keyboard})


def notify_owner(application):
    if not settings.TELEGRAM_ADMIN_BOT_TOKEN:
        return
    for chat_id in settings.TELEGRAM_ADMIN_USER_IDS:
        card(chat_id, application)


def show_pending(chat_id):
    pending = BusinessApplication.objects.filter(status=BusinessApplicationStatus.PENDING)
    send(chat_id, f'<b>Biznes arizalari</b>\nKutilayotgan arizalar: {pending.count()} ta.', {
        'inline_keyboard': [[{'text': 'Yangilash', 'callback_data': 'list'}]],
    })
    for application in pending.order_by('created_at')[:10]:
        card(chat_id, application)


def handle_update(update):
    callback = update.get('callback_query')
    message = (callback.get('message') or {}) if callback else (update.get('message') or {})
    sender = (callback or message).get('from') or {}
    chat = message.get('chat') or {}
    sender_id = str(sender.get('id', ''))
    # Fail closed; group messages, forwarded identities and arbitrary role-bearing
    # database users cannot grant themselves access to this bot.
    if (sender_id not in settings.TELEGRAM_ADMIN_USER_IDS or
            chat.get('type') != 'private' or str(chat.get('id')) != sender_id):
        if callback:
            api('answerCallbackQuery', {'callback_query_id': callback['id'], 'text': 'Ruxsat berilmagan.'})
        return
    admin = reviewer()
    if not admin:
        send(sender_id, 'Sayt egasining hisobi sozlanmagan. TELEGRAM_ADMIN_REVIEWER_EMAIL ni tekshiring.')
        return

    if callback:
        data = callback.get('data', '')
        if data == 'list':
            api('answerCallbackQuery', {'callback_query_id': callback['id']})
            return show_pending(sender_id)
        action, _, application_id = data.partition(':')
        if action not in ('approve', 'reject'):
            return
        with transaction.atomic():
            application = BusinessApplication.objects.select_for_update().filter(id=application_id).first()
            if not application or application.status != BusinessApplicationStatus.PENDING:
                return api('answerCallbackQuery', {
                    'callback_query_id': callback['id'], 'text': 'Ariza topilmadi yoki allaqachon ko‘rib chiqilgan.',
                })
            if action == 'approve':
                try:
                    approve_business_application(application, admin)
                except ValueError as exc:
                    return api('answerCallbackQuery', {'callback_query_id': callback['id'], 'text': str(exc)[:190]})
                log_audit(admin, 'BUSINESS_APPLICATION_APPROVED', 'BUSINESS_APPLICATION', application.id,
                          'Yopiq Telegram admin bot orqali tasdiqlandi')
                text = f'<b>Tasdiqlandi</b>\n{esc(application.name)} katalogga qo‘shildi.'
            else:
                # One rejection prompt at a time; the next text must not reject an unrelated application.
                BusinessApplication.objects.filter(awaiting_reject_from=sender_id).update(awaiting_reject_from='')
                application.awaiting_reject_from = sender_id
                application.save(update_fields=['awaiting_reject_from', 'updated_at'])
                text = f'<b>Rad etish sababi</b>\n{esc(application.name)} uchun sababni yozing.\n/bekor — bekor qilish.'
        api('answerCallbackQuery', {'callback_query_id': callback['id'], 'text': 'Tasdiqlandi' if action == 'approve' else 'Sababni yozing'})
        if action == 'approve':
            api('editMessageText', {'chat_id': sender_id, 'message_id': message['message_id'],
                                   'text': text, 'parse_mode': 'HTML', 'reply_markup': {'inline_keyboard': []}})
        else:
            send(sender_id, text)
        return

    text = (message.get('text') or '').strip()
    if text in ('/bekor', '/cancel'):
        BusinessApplication.objects.filter(awaiting_reject_from=sender_id).update(awaiting_reject_from='')
        return send(sender_id, 'Rad etish bekor qilindi.')
    if text in ('/start', '/help'):
        return send(sender_id, '<b>NavbatBor · Egasi boshqaruvi</b>\n\n'
                    'Yangi biznes arizalarini shu yerda ko‘rib chiqasiz. '
                    'Tasdiqlangan bizneslar sayt katalogida ko‘rinadi.', {
                        'inline_keyboard': [[{'text': 'Biznes arizalarini ko‘rish', 'callback_data': 'list'}]],
                    })
    if text == '/arizalar':
        return show_pending(sender_id)
    if not text or text.startswith('/'):
        return
    with transaction.atomic():
        application = BusinessApplication.objects.select_for_update().filter(
            awaiting_reject_from=sender_id, status=BusinessApplicationStatus.PENDING,
        ).first()
        if not application:
            return
        reject_business_application(application, admin, text[:2000])
        log_audit(admin, 'BUSINESS_APPLICATION_REJECTED', 'BUSINESS_APPLICATION', application.id,
                  'Yopiq Telegram admin bot orqali rad etildi')
    return send(sender_id, f'<b>Rad etildi</b>\n{esc(application.name)}\nSabab: {esc(application.reject_reason)}')
