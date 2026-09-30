import json
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.authentication.models import User, UserRole, UserStatus
from apps.marketplace.models import Category, City, Business, Service, Staff, BusinessHours, Review, SavedBusiness
from apps.subscriptions.models import SubscriptionPlan
from apps.bookings.models import Booking, BookingStatus
from apps.queues.models import QueueEntry, QueueStatus
from apps.partners.models import CRMLead, PartnerCommission, PartnerReport


class Command(BaseCommand):
    help = 'Seeds initial authentic data for NavbatBor Qarshi pilot'

    def handle(self, *args, **options):
        self.stdout.write("Populating categories...")
        categories_data = [
            {'id': 'cat-stomatology', 'name': 'Stomatologiya', 'slug': 'stomatologiya', 'icon': 'Smile', 'description': 'Tish davolash, implantatsiya va gigiyena'},
            {'id': 'cat-medicine', 'name': 'Tibbiyot', 'slug': 'tibbiyot', 'icon': 'Stethoscope', 'description': 'Klinikalar, poliklinikalar va shifokor qabuli'},
            {'id': 'cat-beauty', 'name': 'Go‘zallik', 'slug': 'gozallik', 'icon': 'Sparkles', 'description': 'Kosmetologiya, vizaj va go‘zallik salonlari'},
            {'id': 'cat-barber', 'name': 'Sartaroshxona', 'slug': 'sartaroshxona', 'icon': 'Scissors', 'description': 'Erkaklar sartaroshxonasi va barbershoplar'},
            {'id': 'cat-education', 'name': 'O‘quv markazi', 'slug': 'oquv-markazi', 'icon': 'GraduationCap', 'description': 'Til kurslari, IT va repetitorlik'},
            {'id': 'cat-auto', 'name': 'Avtoservis', 'slug': 'avtoservis', 'icon': 'Car', 'description': 'Moy almashtirish, diagnostika va ta’mirlash'},
            {'id': 'cat-sport', 'name': 'Sport', 'slug': 'sport', 'icon': 'Dumbbell', 'description': 'Fitnes zallar, suzish havzasi va yoga'},
            {'id': 'cat-consulting', 'name': 'Konsultatsiya', 'slug': 'konsultatsiya', 'icon': 'Briefcase', 'description': 'Yuridik, buxgalteriya va biznes maslahati'},
            {'id': 'cat-other', 'name': 'Boshqa xizmatlar', 'slug': 'boshqa', 'icon': 'Grid', 'description': 'Turli maishiy va professional xizmatlar'},
        ]
        for c in categories_data:
            Category.objects.update_or_create(id=c['id'], defaults=c)

        self.stdout.write("Populating cities...")
        cities_data = [
            {'id': 'city-qarshi', 'name': 'Qarshi', 'region': 'Qashqadaryo viloyati'},
            {'id': 'city-toshkent', 'name': 'Toshkent', 'region': 'Toshkent shahri'},
            {'id': 'city-samarqand', 'name': 'Samarqand', 'region': 'Samarqand viloyati'},
            {'id': 'city-buxoro', 'name': 'Buxoro', 'region': 'Buxoro viloyati'},
        ]
        for city in cities_data:
            City.objects.update_or_create(id=city['id'], defaults=city)

        self.stdout.write("Populating subscription plans...")
        plans_data = [
            {
                'id': 'plan-free',
                'name': 'Bepul',
                'code': 'FREE',
                'price_uzs': 0,
                'max_staff': 1,
                'max_monthly_bookings': 50,
                'features_json': json.dumps(['Asosiy onlayn navbat', '1 ta xodim', 'Oylik 50 ta bron'])
            },
            {
                'id': 'plan-start',
                'name': 'Start',
                'code': 'START',
                'price_uzs': 99000,
                'max_staff': 3,
                'max_monthly_bookings': 200,
                'features_json': json.dumps(['Telegram bildirishnomalar', '3 tagacha xodim', 'Oylik 200 ta bron', 'SMS ogohlantirish'])
            },
            {
                'id': 'plan-pro',
                'name': 'Professional',
                'code': 'PRO',
                'price_uzs': 199000,
                'max_staff': 10,
                'max_monthly_bookings': 1000,
                'features_json': json.dumps(['Jonli TV Navbat Doskasi', '10 tagacha xodim', 'CRM mijozlar bazasi', 'Operator paneli', 'Kengaytirilgan statistika'])
            },
            {
                'id': 'plan-business',
                'name': 'Biznes',
                'code': 'BUSINESS',
                'price_uzs': 399000,
                'max_staff': 50,
                'max_monthly_bookings': 10000,
                'features_json': json.dumps(['Cheksiz xodimlar', 'Cheksiz bron va navbat', 'Maxsus Telegram bot', 'Shaxsiy menejer', 'API integratsiyalari'])
            },
        ]
        for p in plans_data:
            SubscriptionPlan.objects.update_or_create(id=p['id'], defaults=p)

        self.stdout.write("Populating users...")
        users_data = [
            {'id': 'usr-admin-jahongir', 'name': 'Jahongir Rasulov', 'email': 'rasulovjahongir074@gmail.com', 'phone': '+998901234567', 'pass': 'admin123', 'role': UserRole.FOUNDER},
            {'id': 'usr-admin', 'name': 'Super Admin', 'email': 'admin@navbatbor.uz', 'phone': '+998752210000', 'pass': 'admin123', 'role': UserRole.ADMIN},
            {'id': 'usr-operating-partner-qarshi', 'name': 'Alisher Qodirov (Qarshi Boshqaruvchi)', 'email': 'partner@navbatbor.uz', 'phone': '+998971234567', 'pass': 'partner123', 'role': UserRole.OPERATING_PARTNER},
            {'id': 'usr-sales-manager-1', 'name': 'Bobur Mirzayev (Sotuv Menejeri)', 'email': 'sales@navbatbor.uz', 'phone': '+998901112233', 'pass': 'sales123', 'role': UserRole.SALES_MANAGER},
            {'id': 'usr-support-1', 'name': 'Malika Karimova (Qo‘llab-quvvatlash)', 'email': 'support@navbatbor.uz', 'phone': '+998934445566', 'pass': 'support123', 'role': UserRole.SUPPORT},
            {'id': 'usr-owner-1', 'name': 'Azizbek Rahimov', 'email': 'owner@navbatbor.uz', 'phone': '+998901234567', 'pass': 'owner123', 'role': UserRole.BUSINESS_OWNER},
            {'id': 'usr-owner-2', 'name': 'Dilnoza Karimova', 'email': 'beauty@navbatbor.uz', 'phone': '+998912345678', 'pass': 'owner123', 'role': UserRole.BUSINESS_OWNER},
            {'id': 'usr-staff-1', 'name': 'Dr. Jasur Aliyev', 'email': 'staff@navbatbor.uz', 'phone': '+998944445566', 'pass': 'staff123', 'role': UserRole.STAFF},
            {'id': 'usr-customer-1', 'name': 'Sardor Mirzayev', 'email': 'mijoz@navbatbor.uz', 'phone': '+998977778899', 'pass': 'mijoz123', 'role': UserRole.CUSTOMER},
        ]

        created_users = {}
        for u in users_data:
            user, created = User.objects.get_or_create(
                email=u['email'],
                defaults={
                    'id': u['id'],
                    'name': u['name'],
                    'phone': u['phone'],
                    'role': u['role'],
                    'status': UserStatus.ACTIVE,
                    'is_staff': u['role'] in [UserRole.FOUNDER, UserRole.ADMIN]
                }
            )
            user.set_password(u['pass'])
            user.role = u['role']
            user.save()
            created_users[u['email']] = user

        self.stdout.write("Populating authentic businesses in Qarshi...")
        city_qarshi = City.objects.get(id='city-qarshi')
        cat_stom = Category.objects.get(id='cat-stomatology')
        cat_beauty = Category.objects.get(id='cat-beauty')
        cat_barber = Category.objects.get(id='cat-barber')
        cat_med = Category.objects.get(id='cat-medicine')
        cat_auto = Category.objects.get(id='cat-auto')

        owner1 = created_users['owner@navbatbor.uz']
        owner2 = created_users['beauty@navbatbor.uz']

        # Business 1: Nasaf Stomatologiya
        b1, _ = Business.objects.update_or_create(
            slug='nasaf-stomatologiya-markazi',
            defaults={
                'id': 'biz-nasaf-dental',
                'owner': owner1,
                'name': 'Nasaf Stomatologiya Markazi',
                'category': cat_stom,
                'city': city_qarshi,
                'district': 'Markaz',
                'address': 'Mustaqillik shoh ko‘chasi, 24-uy',
                'phone': '+998752212345',
                'description': 'Qarshi shahrida zamonaviy stomatologik yordam. Og‘riqsiz davolash, tishlarni tozalash va gigiyenik restavratsiya.',
                'logo_url': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=300&auto=format&fit=crop&q=80',
                'status': 'APPROVED',
                'is_verified': True,
                'is_sponsored': True,
                'subscription_plan_code': 'PRO',
                'latitude': 38.8615,
                'longitude': 65.7920
            }
        )

        # Business 2: Zarina Beauty Studio
        b2, _ = Business.objects.update_or_create(
            slug='zarina-beauty-studio',
            defaults={
                'id': 'biz-zarina-beauty',
                'owner': owner2,
                'name': 'Zarina Beauty Studio',
                'category': cat_beauty,
                'city': city_qarshi,
                'district': 'Universitet oldi',
                'address': 'Islom Karimov ko‘chasi, 8-uy',
                'phone': '+998912345678',
                'description': 'Qarshi shahrining eng yaxshi stilist va kosmetologlari. Soch turmaklash, tozalash, vizaj va manikyur xizmatlari.',
                'logo_url': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&auto=format&fit=crop&q=80',
                'status': 'APPROVED',
                'is_verified': True,
                'is_sponsored': False,
                'subscription_plan_code': 'PRO',
                'latitude': 38.8550,
                'longitude': 65.7890
            }
        )

        # Business 3: Barbershop "Gentleman Qarshi"
        b3, _ = Business.objects.update_or_create(
            slug='gentleman-barbershop-qarshi',
            defaults={
                'id': 'biz-gentleman-barber',
                'owner': owner1,
                'name': 'Gentleman Barbershop Qarshi',
                'category': cat_barber,
                'city': city_qarshi,
                'district': 'Eski shahar',
                'address': 'Nasaf ko‘chasi, 15-uy',
                'phone': '+998907778899',
                'description': 'Erkaklar uchun zamonaviy soch-soqol olish, spa xizmatlari va qulay muhit.',
                'logo_url': 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=300&auto=format&fit=crop&q=80',
                'status': 'APPROVED',
                'is_verified': True,
                'is_sponsored': False,
                'subscription_plan_code': 'START',
                'latitude': 38.8680,
                'longitude': 65.7980
            }
        )

        # Services for Nasaf Stomatologiya
        s1, _ = Service.objects.update_or_create(id='srv-stom-kons', defaults={'business': b1, 'name': 'Birlamchi ko‘rik va konsultatsiya', 'description': 'Shifokor ko‘rigi, rentgen tahlili va davolash rejasi', 'price_uzs': 50000, 'duration_minutes': 20, 'is_active': True})
        s2, _ = Service.objects.update_or_create(id='srv-stom-plomba', defaults={'business': b1, 'name': 'Nurli kompozit plomba qo‘yish', 'description': 'Germaniya materiallari asosida og‘riqsiz plomba', 'price_uzs': 200000, 'duration_minutes': 40, 'is_active': True})
        s3, _ = Service.objects.update_or_create(id='srv-stom-tozalash', defaults={'business': b1, 'name': 'Professional tish tozalash (AirFlow)', 'description': 'Toshlarni tushirish va emalni oqartirish', 'price_uzs': 250000, 'duration_minutes': 45, 'is_active': True})

        # Staff for Nasaf Stomatologiya
        stf1, _ = Staff.objects.update_or_create(
            id='stf-jasur-aliyev',
            defaults={
                'business': b1,
                'name': 'Dr. Jasur Aliyev',
                'title': 'Bosh shifokor, Terapevt-stomatolog',
                'phone': '+998944445566',
                'avatar_url': 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80',
                'is_active': True
            }
        )
        stf1.services.set([s1, s2, s3])

        # Business hours (Mon-Sat 09:00 - 18:00)
        for biz in [b1, b2, b3]:
            for dow in range(7):
                is_sun = (dow == 6)
                BusinessHours.objects.update_or_create(
                    business=biz,
                    day_of_week=dow,
                    defaults={
                        'open_time': '09:00',
                        'close_time': '18:00',
                        'is_closed': is_sun,
                        'break_start': '13:00' if not is_sun else '',
                        'break_end': '14:00' if not is_sun else ''
                    }
                )

        # Reviews
        cust = created_users['mijoz@navbatbor.uz']
        Review.objects.update_or_create(
            id='rev-pilot-1',
            defaults={
                'business': b1,
                'customer': cust,
                'rating': 5,
                'comment': 'Qarshida shunday onlayn navbat tizimi borligidan juda xursandman! Kutish vaqti umuman tejaldi, xizmat esa a’lo darajada.'
            }
        )

        # Live Queue Entries
        QueueEntry.objects.update_or_create(
            id='que-a025',
            defaults={
                'business': b1,
                'service': s1,
                'staff': stf1,
                'customer': cust,
                'customer_name': 'Vali Karimov',
                'customer_phone': '+998911112233',
                'queue_number': 'A025',
                'status': QueueStatus.SERVING,
                'estimated_wait_minutes': 0,
                'served_at': timezone.now()
            }
        )
        QueueEntry.objects.update_or_create(
            id='que-a026',
            defaults={
                'business': b1,
                'service': s2,
                'staff': stf1,
                'customer': None,
                'customer_name': 'Jasur Rahimov',
                'customer_phone': '+998933334455',
                'queue_number': 'A026',
                'status': QueueStatus.CALLED,
                'estimated_wait_minutes': 5,
                'called_at': timezone.now()
            }
        )
        QueueEntry.objects.update_or_create(
            id='que-a027',
            defaults={
                'business': b1,
                'service': s3,
                'staff': stf1,
                'customer': None,
                'customer_name': 'Otabek Rustamov',
                'customer_phone': '+998971112244',
                'queue_number': 'A027',
                'status': QueueStatus.WAITING,
                'estimated_wait_minutes': 25
            }
        )

        # Bookings
        today = timezone.now().date()
        Booking.objects.update_or_create(
            booking_number='NB-100201',
            defaults={
                'id': 'bkg-demo-1',
                'business': b1,
                'service': s1,
                'staff': stf1,
                'customer': cust,
                'customer_name': cust.name,
                'customer_phone': cust.phone,
                'booking_date': today + timedelta(days=1),
                'start_time': '10:00',
                'end_time': '10:30',
                'total_price_uzs': s1.price_uzs,
                'status': BookingStatus.CONFIRMED
            }
        )

        # CRM Leads
        partner_user = created_users['partner@navbatbor.uz']
        CRMLead.objects.update_or_create(
            id='lead-qarshi-1',
            defaults={
                'business_name': 'Qarshi Med Grand Klinika',
                'contact_person': 'Bekzod Fayzullayev',
                'phone': '+998912223344',
                'city': 'Qarshi',
                'category': 'Tibbiyot',
                'status': 'MEETING',
                'notes': 'Rahbariyat bilan uchrashuv belgilangan. 8 ta shifokorni tizimga kiritish rejalashtirilmoqda.',
                'assigned_to': partner_user
            }
        )
        CRMLead.objects.update_or_create(
            id='lead-qarshi-2',
            defaults={
                'business_name': 'Nasaf Avtoservis & Tyuning',
                'contact_person': 'Sherali Normatov',
                'phone': '+998905556677',
                'city': 'Qarshi',
                'category': 'Avtoservis',
                'status': 'WON',
                'notes': 'Shartnoma imzolandi, to‘lov kutilmoqda.',
                'assigned_to': partner_user
            }
        )

        # Partner Commission
        PartnerCommission.objects.update_or_create(
            id='com-qarshi-1',
            defaults={
                'partner': partner_user,
                'business': b1,
                'amount_uzs': 1200000,
                'period_month': '2026-09',
                'status': 'PENDING',
                'payout_notes': 'Qarshi pilot ulush komissiyasi'
            }
        )

        self.stdout.write(self.style.SUCCESS("Successfully seeded authentic Qarshi pilot data into Django!"))
