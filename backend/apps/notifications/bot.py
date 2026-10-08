"""Telegram bot update handler (shared by `manage.py telegram_bot` polling and the webhook view).

Supported flows:
* `/start auth_<session>` or sending the 6-digit code -> asks for explicit confirmation, then
  the inline button `auth_ok_<session>` confirms the browser TelegramAuthSession.
* `/start link_<token>` -> links the NavbatBor account (TelegramLinkToken) to this chat.
* `/start queue_<entry>` -> subscribes this chat to a queue ticket's notifications.
* Inline buttons `confirm_next_<id>` / `cancel_next_<id>` -> pending "call next customer" actions.
* `/biznes` / `/start bizapp` / `/start bizapp_u<user_id>` -> business application,
  including region -> paginated district/city -> address. Submission is routed to
  the private owner bot when configured; legacy public review is then disabled.
* `/arizam` -> application status, resuming an unfinished draft.
"""
import json
import logging
import re

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.authentication.models import TelegramAuthSession, TelegramLinkToken, User, UserStatus
from apps.authentication.permissions import ADMIN_ROLES
from apps.authentication.telegram import TelegramAuthError, get_or_create_telegram_user
from apps.marketplace.models import BusinessApplicationStep as _Step
from apps.marketplace.locations import city_for_district, get_district, get_region, regions

from .services import TELEGRAM_API, esc, send_telegram_message, telegram_api

logger = logging.getLogger('apps.notifications.bot')

CODE_RE = re.compile(r'^\d{6}$')
PHONE_RE = re.compile(r'^\+?[0-9 ()-]{7,20}$')
MAX_APPLICATION_PHOTOS = 6
DISTRICT_PAGE_SIZE = 8
MAX_PHOTO_DOWNLOAD_BYTES = 10 * 1024 * 1024

# Uzbek (Latin) weekday names -> JS-style day_of_week (0=Yakshanba/Sunday ... 6=Shanba/Saturday).
WEEKDAY_ALIASES = {
    'dushanba': 1, 'seshanba': 2, 'chorshanba': 3, 'payshanba': 4,
    'juma': 5, 'shanba': 6, 'yakshanba': 0,
}
WEEKDAY_CHAIN = [1, 2, 3, 4, 5, 6, 0]  # Monday..Sunday, the order a "<start>-<end>" range walks
WEEKDAY_RE = re.compile(r'\b(' + '|'.join(WEEKDAY_ALIASES) + r')\b')
WEEKDAY_LABELS = {0: 'Yak', 1: 'Dush', 2: 'Sesh', 3: 'Chor', 4: 'Pay', 5: 'Jum', 6: 'Shan'}
TIME_RANGE_RE = re.compile(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})')
EVERY_DAY_RE = re.compile(r'har\s+kun')

HOURS_EXAMPLE = 'Masalan: <i>Dushanba-Shanba, 09:00-18:00</i> yoki <i>Har kuni, 10:00-19:00</i>'


def handle_update(update):
    """Process one Telegram Update dict. Never raises (errors are logged)."""
    try:
        if 'callback_query' in update:
            _handle_callback(update['callback_query'])
        elif 'message' in update:
            _handle_message(update['message'])
    except Exception:  # pragma: no cover - defensive: one bad update must not stop the bot
        logger.exception('telegram_update_failed update_id=%s', update.get('update_id'))


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
def _handle_message(message):
    chat = message.get('chat') or {}
    sender = message.get('from') or {}
    if chat.get('type') != 'private' or not sender.get('id'):
        return  # identity flows only make sense in a private chat with the user
    chat_id = str(chat['id'])
    text = (message.get('text') or '').strip()

    if text in ('/arizam', '/status'):
        return _bizapp_status(chat_id)
    if text == '/biznes':
        return _bizapp_start(chat_id, sender, '')

    if text.startswith('/start auth_'):
        return _prompt_auth(chat_id, TelegramAuthSession.objects.filter(session_id=text[len('/start auth_'):].strip()).first())
    if CODE_RE.match(text):
        return _prompt_auth(chat_id, TelegramAuthSession.objects.filter(code=text, status='PENDING').order_by('-created_at').first())
    if text.startswith('/start link_'):
        return _link_account(chat_id, sender, text[len('/start link_'):].strip())
    if text.startswith('/start queue_') or text.startswith('/start q_'):
        return _link_queue_ticket(chat_id, text.split('_', 1)[1].strip())
    if text.startswith('/start bizapp'):
        return _bizapp_start(chat_id, sender, text[len('/start bizapp'):].strip())
    if text in ('/bekor_qilish', '/cancel'):
        return _bizapp_cancel(chat_id)
    if text == '/arizalar':
        return _bizapp_admin_list_command(chat_id)

    # An admin who just clicked "❌ Rad etish" has their very next text message treated as
    # the rejection reason, regardless of what else is going on in this chat.
    awaiting_reject_app = _application_awaiting_reject(chat_id)
    if awaiting_reject_app:
        return _bizapp_receive_reject_reason(awaiting_reject_app, chat_id, text)

    draft = _draft_application_for_chat(chat_id)
    if draft:
        if text in ('/start', '/help', '/yordam'):
            send_telegram_message(chat_id, '📝 Arizangiz saqlangan. Quyidagi qadamdan davom eting.\n'
                                  '/arizam — holat\n/bekor_qilish — bekor qilish')
            return _bizapp_prompt_step(draft)
        photos = message.get('photo')
        if draft.step == _Step.ASK_PHOTOS and photos:
            return _bizapp_receive_photo(draft, photos)
        return _bizapp_handle_text(draft, text, message)

    if text.startswith('/start') or text in ('/help', '/yordam'):
        return send_telegram_message(chat_id, (
            '🏢 <b>NavbatBor · Biznesni ro‘yxatdan o‘tkazish</b>\n\n'
            'Biznesingizni mijozlar topadigan katalogga qo‘shing.\n'
            '1. Biznes ma’lumotlarini kiriting.\n'
            '2. Viloyat va tuman/shaharni tanlang.\n'
            '3. Rasmlarni yuborib, arizani tekshiruvga jo‘nating.\n\n'
            'Tasdiqlangach, biznesingiz saytda ko‘rinadi.\n'
            'Ro‘yxatdan o‘tish bepul.\n\n'
            '/arizam — ariza holati\n/yordam — yordam\n'
            'Bu bot saytga kirish va navbat eslatmalarini ham qo‘llab-quvvatlaydi.'
        ), {'inline_keyboard': [
            [{'text': '➕ Biznesni qo‘shish', 'callback_data': 'bizapp_begin'}],
            [{'text': '📋 Arizam holati', 'callback_data': 'bizapp_status'}],
        ]})
    return None


def _session_usable(session):
    return session is not None and session.status == 'PENDING' and session.expires_at > timezone.now()


def _prompt_auth(chat_id, session):
    if not _session_usable(session):
        return send_telegram_message(chat_id, '⚠️ Kirish sessiyasi topilmadi yoki muddati tugagan. Saytda qaytadan urinib ko‘ring.')
    return send_telegram_message(chat_id, (
        '🔐 <b>NavbatBor saytiga kirish so‘rovi</b>\n\n'
        f'Tasdiqlash kodi: <code>{esc(session.code)}</code>\n'
        'Agar bu siz bo‘lsangiz va brauzerda shu kodni ko‘rayotgan bo‘lsangiz, «Kirish» tugmasini bosing.\n'
        '<i>Begona odam yuborgan havola bo‘lsa — rad eting.</i>'
    ), {'inline_keyboard': [[
        {'text': '✅ Kirish', 'callback_data': f'auth_ok_{session.session_id}'},
        {'text': '❌ Rad etish', 'callback_data': f'auth_no_{session.session_id}'},
    ]]})


def _link_account(chat_id, sender, token):
    now = timezone.now()
    with transaction.atomic():
        record = TelegramLinkToken.objects.select_for_update().select_related('user').filter(token=token).first()
        if not record or record.is_used or record.expires_at <= now or record.user is None:
            return send_telegram_message(chat_id, '⚠️ Ulanish havolasi eskirgan yoki topilmadi. Saytdan yangi havola oling.')
        user = record.user
        if not user.is_active or user.status == UserStatus.SUSPENDED:
            return send_telegram_message(chat_id, '⚠️ Hisob faol emas.')
        # One NavbatBor account per Telegram chat: unlink it from any other account first.
        User.objects.filter(telegram_chat_id=chat_id).exclude(pk=user.pk).update(telegram_chat_id=None)
        user.telegram_chat_id = chat_id
        user.telegram_username = (sender.get('username') or user.telegram_username or '')[:128] or None
        user.telegram_notifications_enabled = True
        user.save(update_fields=['telegram_chat_id', 'telegram_username', 'telegram_notifications_enabled'])
        user.owned_businesses.filter(telegram_chat_id='').update(telegram_chat_id=chat_id)
        record.is_used = True
        record.save(update_fields=['is_used'])
    return send_telegram_message(chat_id, (
        '✅ <b>Muvaffaqiyatli ulandi!</b>\n'
        f'NavbatBor profilingiz (<b>{esc(user.name)}</b>) ushbu bot bilan bog‘landi. '
        'Endi navbat va bron bildirishnomalarini shu yerda olasiz.'
    ))


def _link_queue_ticket(chat_id, entry_id):
    from apps.queues.models import ACTIVE_QUEUE_STATUSES, QueueEntry

    entry = QueueEntry.objects.select_related('business').filter(id=entry_id, status__in=ACTIVE_QUEUE_STATUSES).first()
    if not entry:
        return send_telegram_message(chat_id, '⚠️ Faol navbat topilmadi.')
    if not entry.telegram_chat_id:
        QueueEntry.objects.filter(pk=entry.pk).update(telegram_chat_id=chat_id)
    elif entry.telegram_chat_id != chat_id:
        return send_telegram_message(chat_id, '⚠️ Bu chipta boshqa Telegram hisobiga ulangan.')
    return send_telegram_message(chat_id, (
        '🎫 <b>NavbatBor elektron chiptasi</b>\n━━━━━━━━━━━━━━━━\n'
        f'🏢 Muassasa: <b>{esc(entry.business.name)}</b>\n'
        f'🔢 Navbat raqamingiz: <code>#{esc(entry.queue_number)}</code>\n'
        'Navbatingiz kelganda shu yerga xabar yuboramiz.'
    ))


# ---------------------------------------------------------------------------
# Inline buttons (generic dispatch)
# ---------------------------------------------------------------------------
def _answer(callback, text):
    telegram_api('answerCallbackQuery', {'callback_query_id': callback.get('id'), 'text': text[:190]})


def _edit(callback, text):
    msg = callback.get('message') or {}
    if not (msg.get('chat') and msg.get('message_id')):
        return None
    # The message we are editing may be a photo (sendPhoto -> has a caption, no editable text)
    # or a plain text message; try the matching edit method and fall back silently otherwise.
    method = 'editMessageCaption' if msg.get('caption') is not None or msg.get('photo') else 'editMessageText'
    payload = {'chat_id': msg['chat']['id'], 'message_id': msg['message_id'], 'parse_mode': 'HTML',
               'reply_markup': {'inline_keyboard': []}}
    payload['caption' if method == 'editMessageCaption' else 'text'] = text
    return telegram_api(method, payload)


def _handle_callback(callback):
    data = callback.get('data') or ''
    sender = callback.get('from') or {}
    if not sender.get('id'):
        return
    if data.startswith('bizapp_'):
        chat = (callback.get('message') or {}).get('chat') or {}
        if chat.get('type') != 'private' or str(chat.get('id')) != str(sender['id']):
            return _answer(callback, 'Botga shaxsiy xabar yozing.')
    if data == 'bizapp_status':
        _answer(callback, 'Ariza holati')
        return _bizapp_status(str(sender['id']))
    if data == 'bizapp_begin':
        chat = (callback.get('message') or {}).get('chat') or {}
        if chat.get('type') != 'private' or str(chat.get('id')) != str(sender['id']):
            return _answer(callback, 'Botga shaxsiy xabar yozing.')
        _answer(callback, 'Ariza boshlanmoqda')
        return _bizapp_start(str(sender['id']), sender, '')
    if data.startswith('auth_ok_') or data.startswith('auth_no_'):
        return _auth_decision(callback, sender, data[len('auth_ok_'):], approve=data.startswith('auth_ok_'))
    if data.startswith('confirm_next_') or data.startswith('cancel_next_'):
        return _pending_decision(callback, sender, data.split('_', 2)[2], confirm=data.startswith('confirm_next_'))
    if data.startswith('bizapp_cat:'):
        return _bizapp_category_chosen(callback, sender, data[len('bizapp_cat:'):])
    if data.startswith('bizapp_city:'):
        _answer(callback, 'Hudud tanlash yangilandi. Viloyatni qaytadan tanlang.')
        application = _draft_application_for_chat(str(sender['id']))
        return _bizapp_prompt_step(application) if application else None
    if data.startswith('bizapp_region:'):
        return _bizapp_region_chosen(callback, sender, data.partition(':')[2])
    if data.startswith('bizapp_district:') or data.startswith('bizapp_dpage:'):
        return _bizapp_district_callback(callback, sender, data)
    if data == 'bizapp_regions':
        return _bizapp_regions_back(callback, sender)
    if data == 'bizapp_submit':
        return _bizapp_submit(callback, sender)
    if data == 'bizapp_restart':
        return _bizapp_restart(callback, sender)
    if data.startswith('bizapp_approve:'):
        if settings.TELEGRAM_ADMIN_BOT_TOKEN:
            return _answer(callback, 'Arizalar faqat yopiq admin botda ko‘rib chiqiladi.')
        return _bizapp_approve_callback(callback, sender, data[len('bizapp_approve:'):])
    if data.startswith('bizapp_reject:'):
        if settings.TELEGRAM_ADMIN_BOT_TOKEN:
            return _answer(callback, 'Arizalar faqat yopiq admin botda ko‘rib chiqiladi.')
        return _bizapp_reject_callback(callback, sender, data[len('bizapp_reject:'):])
    _answer(callback, 'Noma’lum amal')


def _auth_decision(callback, sender, session_id, approve):
    with transaction.atomic():
        session = TelegramAuthSession.objects.select_for_update().filter(session_id=session_id).first()
        if not _session_usable(session):
            _answer(callback, 'Sessiya muddati tugagan')
            return _edit(callback, '⚠️ Kirish sessiyasi muddati tugagan.')
        if not approve:
            session.status = 'EXPIRED'
            session.save(update_fields=['status'])
            _answer(callback, 'Rad etildi')
            return _edit(callback, '❌ Kirish so‘rovi rad etildi.')
        try:
            user = get_or_create_telegram_user(sender)
        except TelegramAuthError as exc:
            _answer(callback, str(exc))
            return _edit(callback, f'⚠️ {esc(exc)}')
        session.status = 'CONFIRMED'
        session.user = user
        session.telegram_chat_id = str(sender['id'])
        session.confirmed_at = timezone.now()
        session.save(update_fields=['status', 'user', 'telegram_chat_id', 'confirmed_at'])
    _answer(callback, 'Tasdiqlandi')
    return _edit(callback, f'✅ <b>Muvaffaqiyatli kirdingiz, {esc(user.name)}!</b>\nBrauzerga qayting.')


def _pending_decision(callback, sender, action_id, confirm):
    from apps.marketplace.services import can_manage_business
    from apps.queues import services as queue_services
    from apps.queues.models import PendingQueueAction

    action = PendingQueueAction.objects.select_related('business', 'called_entry').filter(id=action_id).first()
    operator = User.objects.filter(telegram_chat_id=str(sender['id']), is_active=True).first()
    if not action or not operator or not can_manage_business(operator, action.business):
        return _answer(callback, 'Ruxsat berilmagan')
    try:
        if confirm:
            called, _prev = queue_services.confirm_pending(action, operator, source='TELEGRAM')
            _answer(callback, 'Keyingi mijoz chaqirildi')
            label = f'#{esc(called.queue_number)} — {esc(called.customer_name)}' if called else 'yo‘q'
            return _edit(callback, f'✅ Keyingi mijoz chaqirildi: {label}')
        queue_services.cancel_pending(action, operator)
        _answer(callback, 'Bekor qilindi')
        return _edit(callback, '❌ Keyingi mijozni chaqirish bekor qilindi.')
    except Exception as exc:  # QueueError -> show its message
        detail = getattr(exc, 'detail', None)
        message = detail.get('error') if isinstance(detail, dict) else str(exc)
        _answer(callback, str(message))
        return None


# ---------------------------------------------------------------------------
# Business application: conversation state helpers
# ---------------------------------------------------------------------------
def _draft_application_for_chat(chat_id):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus
    return BusinessApplication.objects.filter(
        telegram_chat_id=chat_id, status=BusinessApplicationStatus.DRAFT
    ).order_by('-created_at').first()


def _application_awaiting_reject(chat_id):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus
    return BusinessApplication.objects.filter(
        awaiting_reject_from=chat_id, status=BusinessApplicationStatus.PENDING
    ).order_by('-updated_at').first()


def _is_admin_chat(chat_id):
    return User.objects.filter(telegram_chat_id=chat_id, role__in=ADMIN_ROLES, is_active=True).exists()


# ---------------------------------------------------------------------------
# Business application: start / cancel
# ---------------------------------------------------------------------------
def _bizapp_start(chat_id, sender, suffix):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus

    if BusinessApplication.objects.filter(telegram_chat_id=chat_id, status=BusinessApplicationStatus.PENDING).exists():
        return send_telegram_message(chat_id, (
            'ℹ️ Sizda allaqachon ko‘rib chiqilayotgan arizangiz bor. '
            'Administrator tasdiqlagach yoki rad etsa shu yerga xabar beramiz.'
        ))

    draft = _draft_application_for_chat(chat_id)
    if draft:
        send_telegram_message(chat_id, '↩️ Avval boshlagan arizangizni davom ettiramiz.')
        return _bizapp_prompt_step(draft)

    # The `_u<id>` deep-link suffix is only a UX shortcut (skip asking who they are if the
    # frontend already knew). It must NEVER be trusted to attribute an application to an
    # arbitrary user id someone crafted into a link — only accept it when THIS chat is
    # already linked (via telegram_chat_id) to that exact account, i.e. ownership already
    # proven through the real `/start link_<token>` flow. Otherwise fall through to the
    # normal by-chat-id lookup / new-account creation in `_applicant_user()` at approval time.
    applicant = None
    if suffix.startswith('_u'):
        candidate_id = suffix[2:].strip()
        applicant = User.objects.filter(id=candidate_id, telegram_chat_id=chat_id).first()

    application = BusinessApplication.objects.create(
        telegram_chat_id=chat_id,
        telegram_user_id=str(sender.get('id') or ''),
        telegram_username=(sender.get('username') or '')[:128],
        applicant=applicant,
    )
    send_telegram_message(chat_id, (
        '🏢 <b>NavbatBorga biznesingizni qo‘shish</b>\n━━━━━━━━━━━━━━━━\n'
        'Hozir bir nechta savol beramiz. Istalgan vaqtda /bekor_qilish yuborib jarayonni to‘xtatishingiz mumkin.'
    ))
    return _bizapp_prompt_step(application)


def _bizapp_cancel(chat_id):
    draft = _draft_application_for_chat(chat_id)
    if not draft:
        return send_telegram_message(chat_id, 'Faol ariza topilmadi.')
    draft.delete()
    return send_telegram_message(chat_id, '🗑 Ariza bekor qilindi. Qaytadan boshlash uchun /start bizapp yuboring.')


def _bizapp_status(chat_id):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus

    application = BusinessApplication.objects.filter(telegram_chat_id=chat_id).order_by('-created_at').first()
    if not application:
        return send_telegram_message(chat_id, 'Hali ariza yubormagansiz. Biznesingizni qo‘shish uchun /biznes ni bosing.')
    labels = {
        BusinessApplicationStatus.DRAFT: '📝 To‘ldirish davom etmoqda',
        BusinessApplicationStatus.PENDING: '⏳ Sayt egasi ko‘rib chiqmoqda',
        BusinessApplicationStatus.APPROVED: '✅ Tasdiqlangan — biznesingiz katalogda',
        BusinessApplicationStatus.REJECTED: '❌ Rad etilgan',
    }
    text = f"<b>{esc(application.name or 'Yangi biznes')}</b>\n{labels[application.status]}"
    if application.reject_reason:
        text += f'\nSabab: {esc(application.reject_reason[:1000])}'
    send_telegram_message(chat_id, text)
    if application.status == BusinessApplicationStatus.DRAFT:
        return _bizapp_prompt_step(application)


# ---------------------------------------------------------------------------
# Business application: step prompts
# ---------------------------------------------------------------------------
def _bizapp_prompt_step(application):
    chat_id = application.telegram_chat_id
    step = application.step

    if step == _Step.ASK_NAME:
        return send_telegram_message(chat_id, '<b>1/9 · Biznes nomi</b>\n\nBiznesingiz nomini yozing.\nMasalan: Nasaf klinikasi\n\n/bekor_qilish — arizani bekor qilish')

    if step == _Step.ASK_CATEGORY:
        from apps.marketplace.models import Category
        categories = list(Category.objects.filter(active=True).order_by('name'))
        if not categories:
            return send_telegram_message(chat_id, '⚠️ Hozircha kategoriyalar mavjud emas. Keyinroq urinib ko‘ring.')
        rows = [[{'text': c.name, 'callback_data': f'bizapp_cat:{i}'}] for i, c in enumerate(categories)]
        return send_telegram_message(chat_id, '<b>2/9 · Faoliyat turi</b>\n\nQaysi sohada faoliyat yuritasiz?', {'inline_keyboard': rows})

    if step == _Step.ASK_CITY:
        rows = [[{'text': region['name'], 'callback_data': f"bizapp_region:{region['id']}"}] for region in regions()]
        return send_telegram_message(chat_id, '<b>3/9 · Viloyat</b>\n\nBiznesingiz joylashgan hududni tanlang:', {'inline_keyboard': rows})

    if step == _Step.ASK_DISTRICT:
        region = get_region(application.region or (application.city.region if application.city_id else ''))
        if not region:
            application.step = _Step.ASK_CITY
            application.save(update_fields=['step', 'updated_at'])
            return _bizapp_prompt_step(application)
        if not application.region:
            application.region = region['name']
            application.save(update_fields=['region', 'updated_at'])
        return _bizapp_prompt_districts(application, region)

    if step == _Step.ASK_ADDRESS:
        return send_telegram_message(chat_id, '<b>5/9 · Aniq manzil</b>\n\n'
                                     f"📍 {esc(application.region)}, {esc(application.district)}\n\n"
                                     'Ko‘cha, uy raqami va mo‘ljalni yozing:')

    if step == _Step.ASK_PHONE:
        return send_telegram_message(chat_id, '<b>6/9 · Bog‘lanish</b>\n\nTelefon raqamingizni yozing.\nMasalan: +998901234567')

    if step == _Step.ASK_HOURS:
        return send_telegram_message(chat_id, (
            '<b>7/9 · Ish vaqti</b>\n\nQaysi kunlar va soatlarda ishlaysiz?\n' + HOURS_EXAMPLE
        ))

    if step == _Step.ASK_DESCRIPTION:
        return send_telegram_message(chat_id, '<b>8/9 · Biznes haqida</b>\n\nQanday xizmatlar ko‘rsatasiz? Qisqacha yozing.\n/skip — o‘tkazib yuborish')

    if step == _Step.ASK_PHOTOS:
        count = application.photos.count()
        return send_telegram_message(chat_id, (
            f'<b>9/9 · Biznes rasmlari</b>\n\nYuklangan: {count}/{MAX_APPLICATION_PHOTOS}\n'
            'Tashqi va ichki ko‘rinishdan kamida bitta rasm yuboring.\n'
            'Tugatgach /done deb yozing.'
        ))

    if step == _Step.CONFIRM:
        return _bizapp_send_confirm(application)

    return None


# ---------------------------------------------------------------------------
# Business application: free-text step handling
# ---------------------------------------------------------------------------
def _bizapp_handle_text(application, text, message):
    step = application.step
    chat_id = application.telegram_chat_id

    if step == _Step.ASK_NAME:
        if not text:
            return send_telegram_message(chat_id, 'Iltimos, biznesingiz nomini yozing.')
        application.name = text[:255]
        application.step = _Step.ASK_CATEGORY
        application.save(update_fields=['name', 'step', 'updated_at'])
        return _bizapp_prompt_step(application)

    if step in (_Step.ASK_CATEGORY, _Step.ASK_CITY):
        return send_telegram_message(chat_id, 'Iltimos, yuqoridagi tugmalardan birini tanlang.')

    if step == _Step.ASK_DISTRICT:
        return _bizapp_prompt_step(application)

    if step == _Step.ASK_ADDRESS:
        if not text:
            return send_telegram_message(chat_id, 'Iltimos, manzilingizni yozing.')
        application.address = text[:255]
        application.step = _Step.ASK_PHONE
        application.save(update_fields=['address', 'step', 'updated_at'])
        return _bizapp_prompt_step(application)

    if step == _Step.ASK_PHONE:
        if not PHONE_RE.match(text):
            return send_telegram_message(chat_id, (
                '⚠️ Telefon raqami noto‘g‘ri formatda. Masalan: +998901234567. Qaytadan kiriting:'
            ))
        application.phone = text[:32]
        application.step = _Step.ASK_HOURS
        application.save(update_fields=['phone', 'step', 'updated_at'])
        return _bizapp_prompt_step(application)

    if step == _Step.ASK_HOURS:
        return _bizapp_handle_hours_text(application, text)

    if step == _Step.ASK_DESCRIPTION:
        if text != '/skip':
            application.description = text[:5000]
        application.step = _Step.ASK_PHOTOS
        application.save(update_fields=['description', 'step', 'updated_at'])
        return _bizapp_prompt_step(application)

    if step == _Step.ASK_PHOTOS:
        if text == '/done':
            if application.photos.count() == 0:
                return send_telegram_message(chat_id, 'Kamida bitta rasm yuborishingiz kerak.')
            application.step = _Step.CONFIRM
            application.save(update_fields=['step', 'updated_at'])
            return _bizapp_prompt_step(application)
        return send_telegram_message(chat_id, 'Iltimos, rasm yuboring yoki tugatish uchun /done deb yozing.')

    if step == _Step.CONFIRM:
        return send_telegram_message(chat_id, 'Iltimos, yuqoridagi tugmalardan birini tanlang.')

    return None  # DONE or unknown: nothing left to say


def _normalize_hhmm(raw):
    match = re.match(r'^(\d{1,2}):(\d{2})$', raw)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return f'{hour:02d}:{minute:02d}'


def _parse_hours_text(text):
    """'Dushanba-Shanba, 09:00-18:00' / 'Har kuni, 10:00-19:00' -> {dow: (open, close, is_closed)}."""
    lowered = text.lower()
    time_match = TIME_RANGE_RE.search(lowered)
    if not time_match:
        return None
    open_time, close_time = _normalize_hhmm(time_match.group(1)), _normalize_hhmm(time_match.group(2))
    if not open_time or not close_time or open_time >= close_time:
        return None

    if EVERY_DAY_RE.search(lowered):
        open_days = set(range(7))
    else:
        found = [WEEKDAY_ALIASES[m.group(1)] for m in WEEKDAY_RE.finditer(lowered)]
        if not found:
            return None
        start_dow, end_dow = found[0], found[-1]
        start_idx, end_idx = WEEKDAY_CHAIN.index(start_dow), WEEKDAY_CHAIN.index(end_dow)
        open_days = set(
            WEEKDAY_CHAIN[start_idx:end_idx + 1] if start_idx <= end_idx
            else WEEKDAY_CHAIN[start_idx:] + WEEKDAY_CHAIN[:end_idx + 1]
        )
    return {dow: (open_time, close_time, dow not in open_days) for dow in range(7)}


def _bizapp_handle_hours_text(application, text):
    chat_id = application.telegram_chat_id
    parsed = _parse_hours_text(text)
    if parsed is None:
        send_telegram_message(chat_id, '⚠️ Ish vaqtini tushuna olmadim.\n' + HOURS_EXAMPLE)
        return None

    from apps.marketplace.models import BusinessApplicationHours
    with transaction.atomic():
        application.hours.all().delete()
        for dow in range(7):
            open_time, close_time, is_closed = parsed[dow]
            BusinessApplicationHours.objects.create(
                application=application, day_of_week=dow, open_time=open_time, close_time=close_time,
                is_closed=is_closed,
            )
        application.step = _Step.ASK_DESCRIPTION
        application.save(update_fields=['step', 'updated_at'])
    return _bizapp_prompt_step(application)


# ---------------------------------------------------------------------------
# Business application: category / region / district inline choice
# ---------------------------------------------------------------------------
def _bizapp_category_chosen(callback, sender, index_raw):
    from apps.marketplace.models import Category

    chat_id = str(sender['id'])
    application = _draft_application_for_chat(chat_id)
    if not application or application.step != _Step.ASK_CATEGORY:
        return _answer(callback, 'Bu qadam faol emas')
    categories = list(Category.objects.filter(active=True).order_by('name'))
    try:
        if int(index_raw) < 0:
            raise ValueError
        category = categories[int(index_raw)]
    except (ValueError, IndexError):
        return _answer(callback, 'Noto‘g‘ri tanlov, qaytadan urinib ko‘ring')
    application.category = category
    application.step = _Step.ASK_CITY
    application.save(update_fields=['category', 'step', 'updated_at'])
    _answer(callback, 'Tanlandi')
    _edit(callback, f'✅ Soha: <b>{esc(category.name)}</b>')
    return _bizapp_prompt_step(application)


def _bizapp_region_chosen(callback, sender, region_id):
    chat_id = str(sender['id'])
    application = _draft_application_for_chat(chat_id)
    if not application or application.step != _Step.ASK_CITY:
        return _answer(callback, 'Bu qadam faol emas')
    region = get_region(region_id)
    if not region:
        return _answer(callback, 'Noto‘g‘ri tanlov, qaytadan urinib ko‘ring')
    application.region = region['name']
    application.city = None
    application.district = ''
    application.step = _Step.ASK_DISTRICT
    application.save(update_fields=['region', 'city', 'district', 'step', 'updated_at'])
    _answer(callback, 'Tanlandi')
    _edit(callback, f"✅ Hudud: <b>{esc(region['name'])}</b>")
    return _bizapp_prompt_step(application)


def _bizapp_prompt_districts(application, region, page=0):
    districts = region['districts']
    pages = (len(districts) + DISTRICT_PAGE_SIZE - 1) // DISTRICT_PAGE_SIZE
    start = page * DISTRICT_PAGE_SIZE
    rows = [[{'text': district['name'],
              'callback_data': f"bizapp_district:{region['id']}:{district['id']}"}]
            for district in districts[start:start + DISTRICT_PAGE_SIZE]]
    navigation = []
    if page:
        navigation.append({'text': '← Oldingi', 'callback_data': f"bizapp_dpage:{region['id']}:{page - 1}"})
    if page + 1 < pages:
        navigation.append({'text': 'Keyingi →', 'callback_data': f"bizapp_dpage:{region['id']}:{page + 1}"})
    if navigation:
        rows.append(navigation)
    rows.append([{'text': '← Viloyatni o‘zgartirish', 'callback_data': 'bizapp_regions'}])
    return send_telegram_message(application.telegram_chat_id,
                                 '<b>4/9 · Tuman yoki shahar</b>\n\n'
                                 f"📍 {esc(region['name'])}\n"
                                 f'Tuman/shaharni tanlang. Sahifa {page + 1}/{pages}.',
                                 {'inline_keyboard': rows})


def _bizapp_district_callback(callback, sender, data):
    parts = data.split(':', 2)
    if len(parts) != 3:
        return _answer(callback, 'Noto‘g‘ri tanlov')
    action, region_id, value = parts
    application = _draft_application_for_chat(str(sender['id']))
    region = get_region(region_id)
    if not application or application.step != _Step.ASK_DISTRICT or not region or application.region != region['name']:
        return _answer(callback, 'Bu tanlov faol emas. Joriy viloyatdan tanlang.')
    if action == 'bizapp_dpage':
        try:
            page = int(value)
        except ValueError:
            return _answer(callback, 'Sahifa topilmadi')
        if not 0 <= page < (len(region['districts']) + DISTRICT_PAGE_SIZE - 1) // DISTRICT_PAGE_SIZE:
            return _answer(callback, 'Sahifa topilmadi')
        _answer(callback, 'Tumanlar')
        # Disable the previous keyboard so a user cannot accidentally pick a stale page.
        _edit(callback, f"📍 {esc(region['name'])} · Sahifa {page + 1}")
        return _bizapp_prompt_districts(application, region, page)
    district = get_district(region, value)
    if not district:
        return _answer(callback, 'Tuman/shahar topilmadi')
    application.city = city_for_district(region, district)
    application.district = district['name']
    application.step = _Step.ASK_ADDRESS
    application.save(update_fields=['city', 'district', 'step', 'updated_at'])
    _answer(callback, 'Tanlandi')
    _edit(callback, f"✅ {esc(region['name'])} · <b>{esc(district['name'])}</b>")
    return _bizapp_prompt_step(application)


def _bizapp_regions_back(callback, sender):
    application = _draft_application_for_chat(str(sender['id']))
    if not application or application.step != _Step.ASK_DISTRICT:
        return _answer(callback, 'Bu qadam faol emas')
    application.region = ''
    application.city = None
    application.district = ''
    application.step = _Step.ASK_CITY
    application.save(update_fields=['region', 'city', 'district', 'step', 'updated_at'])
    _answer(callback, 'Viloyatni tanlang')
    _edit(callback, '↩️ Viloyatni qaytadan tanlang.')
    return _bizapp_prompt_step(application)


# ---------------------------------------------------------------------------
# Business application: photos
# ---------------------------------------------------------------------------
def _bizapp_receive_photo(application, photo_sizes):
    chat_id = application.telegram_chat_id
    if application.photos.count() >= MAX_APPLICATION_PHOTOS:
        return send_telegram_message(chat_id, (
            f'Eng ko‘pi bilan {MAX_APPLICATION_PHOTOS} ta rasm yuborishingiz mumkin. Tugatish uchun /done deb yozing.'
        ))

    largest = max(photo_sizes, key=lambda p: p.get('file_size') or (p.get('width', 0) * p.get('height', 0)))
    file_id = largest.get('file_id')
    file_info = telegram_api('getFile', {'file_id': file_id})
    if not file_info or not file_info.get('file_path'):
        return send_telegram_message(chat_id, '⚠️ Rasmni yuklab olishda xatolik. Qaytadan urinib ko‘ring.')

    token = settings.TELEGRAM_BOT_TOKEN
    file_url = f'https://api.telegram.org/file/bot{token}/{file_info["file_path"]}'
    try:
        response = requests.get(file_url, timeout=15)
        response.raise_for_status()
        content = response.content
    except requests.RequestException:
        logger.warning('bizapp_photo_download_failed application=%s', application.id)
        return send_telegram_message(chat_id, '⚠️ Rasmni yuklab olishda xatolik. Qaytadan urinib ko‘ring.')
    if len(content) > MAX_PHOTO_DOWNLOAD_BYTES:
        return send_telegram_message(chat_id, '⚠️ Rasm hajmi juda katta (10MB dan oshmasligi kerak).')

    from django.core.files.base import ContentFile
    from apps.marketplace.models import BusinessApplicationPhoto

    order = application.photos.count()
    photo = BusinessApplicationPhoto(application=application, telegram_file_id=file_id or '', order=order)
    photo.image.save(f'{application.id}-{order + 1}.jpg', ContentFile(content), save=True)

    count = application.photos.count()
    suffix = '' if count >= MAX_APPLICATION_PHOTOS else ' Yana yuborishingiz mumkin yoki /done deb yozing.'
    return send_telegram_message(chat_id, f'📷 {count}/{MAX_APPLICATION_PHOTOS} rasm qabul qilindi.{suffix}')


# ---------------------------------------------------------------------------
# Business application: confirm / submit / restart
# ---------------------------------------------------------------------------
def _format_hours_summary(application):
    rows = list(application.hours.order_by('day_of_week'))
    open_rows = [r for r in rows if not r.is_closed]
    if not open_rows:
        return 'Ko‘rsatilmagan'
    days = ', '.join(WEEKDAY_LABELS[r.day_of_week] for r in open_rows)
    sample = open_rows[0]
    return f'{days} ({sample.open_time}-{sample.close_time})'


def _bizapp_details_block(application):
    lines = [
        f'🏢 <b>Nomi:</b> {esc(application.name)}',
        f'🏷 <b>Soha:</b> {esc(application.category.name if application.category_id else "-")}',
        f'🗺 <b>Viloyat:</b> {esc(application.region or (application.city.region if application.city_id else "-"))}',
        f'📍 <b>Tuman:</b> {esc(application.district or "-")}',
        f'🗺 <b>Manzil:</b> {esc(application.address)}',
        f'📞 <b>Telefon:</b> {esc(application.phone)}',
        f'🕒 <b>Ish vaqti:</b> {esc(_format_hours_summary(application))}',
        f'📝 <b>Tavsif:</b> {esc(application.description or "-")}',
        f'📷 <b>Rasmlar:</b> {application.photos.count()} ta',
    ]
    return '\n'.join(lines)


def _bizapp_summary_text(application):
    return '📋 <b>Arizangizni tekshiring</b>\n━━━━━━━━━━━━━━━━\n' + _bizapp_details_block(application)


def _bizapp_admin_summary_text(application):
    header = '🆕 <b>Yangi biznes arizasi</b>\n━━━━━━━━━━━━━━━━\n'
    if application.telegram_username:
        header += f'👤 <b>Telegram:</b> @{esc(application.telegram_username)}\n'
    return header + _bizapp_details_block(application)


def _bizapp_send_confirm(application):
    return send_telegram_message(application.telegram_chat_id, _bizapp_summary_text(application), {
        'inline_keyboard': [[
            {'text': '✅ Yuborish', 'callback_data': 'bizapp_submit'},
            {'text': '✏️ Qayta boshlash', 'callback_data': 'bizapp_restart'},
        ]]
    })


def _bizapp_submit(callback, sender):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus

    chat_id = str(sender['id'])
    application = _draft_application_for_chat(chat_id)
    if not application or application.step != _Step.CONFIRM:
        return _answer(callback, 'Bu ariza faol emas')

    with transaction.atomic():
        application = BusinessApplication.objects.select_for_update().get(pk=application.pk)
        if application.status != BusinessApplicationStatus.DRAFT:
            return _answer(callback, 'Allaqachon yuborilgan')
        application.status = BusinessApplicationStatus.PENDING
        application.step = _Step.DONE
        application.save(update_fields=['status', 'step', 'updated_at'])

    _answer(callback, 'Yuborildi!')
    _edit(callback, '✅ Arizangiz adminlarga yuborildi. Tasdiqlangach yoki rad etilsa shu yerga xabar beramiz.')
    _bizapp_broadcast_to_admins(application)
    return None


def _bizapp_restart(callback, sender):
    chat_id = str(sender['id'])
    application = _draft_application_for_chat(chat_id)
    if not application:
        return _answer(callback, 'Ariza topilmadi')
    # Photos are kept (re-uploading them is the most tedious part for the owner); everything
    # else is wiped so the conversation genuinely restarts from the name.
    application.name = ''
    application.category = None
    application.region = ''
    application.city = None
    application.district = ''
    application.address = ''
    application.phone = ''
    application.description = ''
    application.hours.all().delete()
    application.step = _Step.ASK_NAME
    application.save(update_fields=[
        'name', 'category', 'region', 'city', 'district', 'address', 'phone', 'description', 'step', 'updated_at',
    ])
    _answer(callback, 'Qaytadan boshlandi')
    _edit(callback, '🔄 Ma’lumotlar tozalandi (rasmlar saqlandi), qaytadan boshlaymiz.')
    return _bizapp_prompt_step(application)


# ---------------------------------------------------------------------------
# Business application: notify admins + approve/reject from the bot
# ---------------------------------------------------------------------------
def _bizapp_approve_reject_keyboard(application_id):
    return {'inline_keyboard': [[
        {'text': '✅ Tasdiqlash', 'callback_data': f'bizapp_approve:{application_id}'},
        {'text': '❌ Rad etish', 'callback_data': f'bizapp_reject:{application_id}'},
    ]]}


def _send_application_card(chat_id, application, text, keyboard):
    """Send the application summary with its approve/reject buttons, with the first photo
    attached when there is one. Falls back to a plain text message if anything goes wrong
    (unconfigured bot token, network error, missing/corrupt file on disk)."""
    first_photo = application.photos.order_by('order', 'created_at').first()
    token = settings.TELEGRAM_BOT_TOKEN
    if token and first_photo and first_photo.image:
        try:
            with first_photo.image.open('rb') as fh:
                response = requests.post(
                    TELEGRAM_API.format(token=token, method='sendPhoto'),
                    data={'chat_id': chat_id, 'caption': text, 'parse_mode': 'HTML',
                          'reply_markup': json.dumps(keyboard)},
                    files={'photo': (first_photo.image.name, fh, 'image/jpeg')},
                    timeout=15,
                )
            if response.ok and response.json().get('ok'):
                return True
        except (requests.RequestException, OSError, ValueError):
            logger.warning('bizapp_photo_card_failed application=%s', application.id)
    return send_telegram_message(chat_id, text, keyboard)


def _bizapp_broadcast_to_admins(application):
    if settings.TELEGRAM_ADMIN_BOT_TOKEN:
        from .admin_bot import notify_owner
        return notify_owner(application)
    admins = User.objects.filter(role__in=ADMIN_ROLES, is_active=True).exclude(telegram_chat_id='').exclude(telegram_chat_id__isnull=True)
    text = _bizapp_admin_summary_text(application)
    keyboard = _bizapp_approve_reject_keyboard(application.id)
    for admin in admins:
        _send_application_card(admin.telegram_chat_id, application, text, keyboard)


def _bizapp_approve_callback(callback, sender, application_id):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus
    from apps.marketplace.services import approve_business_application

    chat_id = str(sender['id'])
    admin = User.objects.filter(telegram_chat_id=chat_id, role__in=ADMIN_ROLES, is_active=True).first()
    if not admin:
        return _answer(callback, 'Ruxsat berilmagan')

    with transaction.atomic():
        application = BusinessApplication.objects.select_for_update().filter(id=application_id).first()
        if not application:
            return _answer(callback, 'Ariza topilmadi')
        if application.status != BusinessApplicationStatus.PENDING:
            reviewer = application.reviewed_by.name if application.reviewed_by_id else 'boshqa admin'
            _answer(callback, 'Allaqachon ko‘rib chiqilgan')
            return _edit(callback, f'ℹ️ Bu ariza allaqachon ko‘rib chiqilgan ({esc(reviewer)} tomonidan).')
        try:
            business = approve_business_application(application, admin)
        except ValueError as exc:
            _answer(callback, 'Xatolik')
            return _edit(callback, f'⚠️ Xatolik: {esc(exc)}')

    _answer(callback, 'Tasdiqlandi')
    return _edit(callback, f'✅ <b>Tasdiqlandi</b> — {esc(admin.name)} tomonidan.\n🏢 {esc(business.name)} endi katalogda.')


def _bizapp_reject_callback(callback, sender, application_id):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus

    chat_id = str(sender['id'])
    admin = User.objects.filter(telegram_chat_id=chat_id, role__in=ADMIN_ROLES, is_active=True).first()
    if not admin:
        return _answer(callback, 'Ruxsat berilmagan')

    with transaction.atomic():
        application = BusinessApplication.objects.select_for_update().filter(id=application_id).first()
        if not application:
            return _answer(callback, 'Ariza topilmadi')
        if application.status != BusinessApplicationStatus.PENDING:
            _answer(callback, 'Allaqachon ko‘rib chiqilgan')
            return _edit(callback, 'ℹ️ Bu ariza allaqachon ko‘rib chiqilgan.')
        application.awaiting_reject_from = chat_id
        application.save(update_fields=['awaiting_reject_from', 'updated_at'])

    _answer(callback, 'Sababni yozing')
    return send_telegram_message(chat_id, f'❌ «{esc(application.name)}» arizasini rad etish sababini yozib yuboring:')


def _bizapp_receive_reject_reason(application, chat_id, text):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus
    from apps.marketplace.services import reject_business_application

    if settings.TELEGRAM_ADMIN_BOT_TOKEN:
        return None

    reason = text.strip()
    if not reason:
        return send_telegram_message(chat_id, 'Iltimos, rad etish sababini matn sifatida yozing.')

    admin = User.objects.filter(telegram_chat_id=chat_id, role__in=ADMIN_ROLES, is_active=True).first()
    with transaction.atomic():
        application = BusinessApplication.objects.select_for_update().filter(pk=application.pk).first()
        if not application or application.status != BusinessApplicationStatus.PENDING:
            return send_telegram_message(chat_id, 'Bu ariza allaqachon ko‘rib chiqilgan.')
        application.awaiting_reject_from = ''
        application.save(update_fields=['awaiting_reject_from', 'updated_at'])
        reject_business_application(application, admin, reason)
    return send_telegram_message(chat_id, f'❌ Ariza rad etildi: {esc(application.name)}')


def _bizapp_admin_list_command(chat_id):
    from apps.marketplace.models import BusinessApplication, BusinessApplicationStatus

    if settings.TELEGRAM_ADMIN_BOT_TOKEN:
        return None

    if not _is_admin_chat(chat_id):
        return None  # silently ignore for non-admins
    pending = BusinessApplication.objects.filter(status=BusinessApplicationStatus.PENDING).order_by('created_at')
    total = pending.count()
    if not total:
        return send_telegram_message(chat_id, '✅ Hozircha ko‘rib chiqilmagan arizalar yo‘q.')
    shown = list(pending[:10])
    send_telegram_message(chat_id, f'📋 Ko‘rib chiqilmagan arizalar: {total} ta (quyida birinchi {len(shown)} tasi)')
    for application in shown:
        text = _bizapp_admin_summary_text(application)
        keyboard = _bizapp_approve_reject_keyboard(application.id)
        _send_application_card(chat_id, application, text, keyboard)
    return None
