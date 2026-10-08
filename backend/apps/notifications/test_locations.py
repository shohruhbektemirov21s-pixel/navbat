from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.core.testing_utils import BaseAPITestCase, make_category, make_city
from apps.marketplace.locations import city_for_district, get_region, regions
from apps.marketplace.models import BusinessApplication, City
from .bot import handle_update, _bizapp_prompt_step


class UzbekistanDirectoryTests(SimpleTestCase):
    def test_all_regions_and_current_districts_are_present(self):
        self.assertEqual(len(regions()), 14)
        areas = [district for region in regions() for district in region['districts']]
        self.assertEqual(len(areas), 208)
        self.assertEqual(sum(area['name'].endswith('tumani') for area in areas), 177)
        self.assertEqual(sum(area['name'].endswith('shahri') for area in areas), 31)
        for region in regions():
            self.assertTrue(region['districts'])
            self.assertEqual(len({d['id'] for d in region['districts']}), len(region['districts']))
            for district in region['districts']:
                self.assertLessEqual(len(f"bizapp_district:{region['id']}:{district['id']}".encode()), 64)
        self.assertEqual(len(get_region('ts')['districts']), 12)
        self.assertIn('Ko‘kdala tumani', [d['name'] for d in get_region('qa')['districts']])
        self.assertIn('Davlatobod tumani', [d['name'] for d in get_region('nm')['districts']])
        self.assertIn('Yangi Namangan tumani', [d['name'] for d in get_region('nm')['districts']])


@override_settings(TELEGRAM_BOT_TOKEN='', TELEGRAM_ADMIN_BOT_TOKEN='')
class LocationSelectionTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.application = BusinessApplication.objects.create(
            telegram_chat_id='700001', name='Salon', category=make_category(), step='ASK_CITY',
        )
        api_mock = patch('apps.notifications.bot.telegram_api', return_value=True)
        self.api = api_mock.start()
        self.addCleanup(api_mock.stop)
        send_mock = patch('apps.notifications.bot.send_telegram_message', return_value=True)
        self.send = send_mock.start()
        self.addCleanup(send_mock.stop)

    def callback(self, data, sender=700001, kind='private'):
        return {'callback_query': {'id': 'cb', 'from': {'id': sender}, 'data': data,
                'message': {'message_id': 1, 'chat': {'id': sender, 'type': kind}}}}

    def test_region_then_district_stores_correct_location(self):
        handle_update(self.callback('bizapp_region:qa'))
        self.application.refresh_from_db()
        self.assertEqual(self.application.region, 'Qashqadaryo viloyati')
        self.assertEqual(self.application.step, 'ASK_DISTRICT')
        handle_update(self.callback('bizapp_district:qa:kokdala-tumani'))
        self.application.refresh_from_db()
        self.assertEqual(self.application.step, 'ASK_ADDRESS')
        self.assertEqual(self.application.district, 'Ko‘kdala tumani')
        self.assertEqual(self.application.city.region, 'Qashqadaryo viloyati')

    def test_other_region_invalid_id_and_stale_callbacks_do_not_change_location(self):
        handle_update(self.callback('bizapp_region:qa'))
        for data in ['bizapp_district:ts:olmazor-tumani', 'bizapp_district:qa:missing',
                     'bizapp_region:ts', 'bizapp_dpage:qa:-1', 'bizapp_dpage:qa:999']:
            handle_update(self.callback(data))
        self.application.refresh_from_db()
        self.assertEqual(self.application.region, 'Qashqadaryo viloyati')
        self.assertEqual(self.application.step, 'ASK_DISTRICT')
        self.assertIsNone(self.application.city_id)

    def test_another_user_and_group_cannot_change_draft(self):
        handle_update(self.callback('bizapp_region:qa', sender=800002))
        handle_update(self.callback('bizapp_region:qa', kind='group'))
        self.application.refresh_from_db()
        self.assertEqual(self.application.step, 'ASK_CITY')

    def test_pagination_and_region_back_button(self):
        handle_update(self.callback('bizapp_region:tv'))
        handle_update(self.callback('bizapp_dpage:tv:1'))
        keyboard = self.send.call_args.args[2]['inline_keyboard']
        buttons = [button for row in keyboard for button in row]
        self.assertLessEqual(sum(b['callback_data'].startswith('bizapp_district:') for b in buttons), 8)
        self.assertTrue(any(b['callback_data'] == 'bizapp_regions' for b in buttons))
        handle_update(self.callback('bizapp_regions'))
        self.application.refresh_from_db()
        self.assertEqual(self.application.step, 'ASK_CITY')
        self.assertEqual(self.application.region, '')

    def test_every_region_district_is_reachable_through_all_pages(self):
        for region in regions():
            self.application.region = region['name']
            self.application.step = 'ASK_DISTRICT'
            self.application.save()
            seen = set()
            for page in range((len(region['districts']) + 7) // 8):
                handle_update(self.callback(f"bizapp_dpage:{region['id']}:{page}"))
                for row in self.send.call_args.args[2]['inline_keyboard']:
                    seen.update(b['callback_data'].split(':', 2)[2] for b in row
                                if b['callback_data'].startswith('bizapp_district:'))
            self.assertEqual(seen, {d['id'] for d in region['districts']})

    def test_existing_city_is_reused_and_city_district_stay_distinct(self):
        city = make_city(name='Qarshi', region='Qashqadaryo viloyati')
        region = get_region('qa')
        district = next(d for d in region['districts'] if d['name'] == 'Qarshi shahri')
        self.assertEqual(city_for_district(region, district), city)
        district = next(d for d in region['districts'] if d['name'] == 'Qarshi tumani')
        self.assertNotEqual(city_for_district(region, district), city)

    def test_name_collision_never_links_another_region(self):
        make_city(name='Ko‘kdala tumani', region='Other region')
        region = get_region('qa')
        district = next(d for d in region['districts'] if d['id'] == 'kokdala-tumani')
        city = city_for_district(region, district)
        self.assertEqual(city.region, region['name'])
        self.assertEqual(city_for_district(region, district), city)

    def test_arbitrary_district_text_and_skip_cannot_bypass_choice(self):
        handle_update(self.callback('bizapp_region:qa'))
        for text in ['/skip', 'Unknown district', '']:
            handle_update({'message': {'from': {'id': 700001},
                          'chat': {'id': 700001, 'type': 'private'}, 'text': text}})
        self.application.refresh_from_db()
        self.assertEqual(self.application.step, 'ASK_DISTRICT')

    def test_legacy_draft_with_unknown_region_can_resume(self):
        self.application.city = make_city()
        self.application.step = 'ASK_DISTRICT'
        self.application.save()
        _bizapp_prompt_step(self.application)
        self.application.refresh_from_db()
        self.assertEqual(self.application.step, 'ASK_CITY')

    def test_start_and_help_resume_without_overwriting_business_name(self):
        for text in ['/start', '/help', '/yordam', '/arizam']:
            handle_update({'message': {'from': {'id': 700001},
                          'chat': {'id': 700001, 'type': 'private'}, 'text': text}})
        self.application.refresh_from_db()
        self.assertEqual(self.application.name, 'Salon')
        self.assertEqual(self.application.step, 'ASK_CITY')

    def test_all_locations_can_be_saved_without_name_or_id_collisions(self):
        for region in regions():
            for district in region['districts']:
                city = city_for_district(region, district)
                self.assertEqual(city.region, region['name'])
        self.assertEqual(City.objects.count(), 208)

    def test_pagination_removes_old_keyboard(self):
        handle_update(self.callback('bizapp_region:tv'))
        handle_update(self.callback('bizapp_dpage:tv:1'))
        edit_calls = [call for call in self.api.call_args_list if call.args[0] == 'editMessageText']
        self.assertEqual(edit_calls[-1].args[1]['reply_markup'], {'inline_keyboard': []})
