from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from apps.core.testing_utils import BaseAPITestCase, make_category, make_city, make_user
from .models import Business, BusinessApplication, BusinessApplicationStatus


class WebsiteApplicationTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user()
        self.client.force_authenticate(self.user)
        self.category, self.city = make_category(), make_city()
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.directory.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

    def data(self):
        image = BytesIO()
        Image.new('RGB', (16, 16)).save(image, format='PNG')
        return {'name': 'Test salon', 'category': self.category.id, 'city': self.city.id,
                'address': 'Test street 42', 'phone': '+998901234567', 'description': 'Salon',
                'open_time': '09:00', 'close_time': '18:00', 'working_days': [1, 2, 3, 4, 5],
                'photos': [SimpleUploadedFile('salon.png', image.getvalue(), content_type='image/png')]}

    def test_valid_application_stays_pending_and_not_in_public_catalog(self):
        with patch('apps.marketplace.application_views.notify_owner') as notify, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/api/business-applications', self.data(), format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        application = BusinessApplication.objects.get()
        self.assertEqual(application.applicant, self.user)
        self.assertEqual(application.status, BusinessApplicationStatus.PENDING)
        self.assertEqual(application.hours.count(), 7)
        self.assertEqual(application.hours.filter(is_closed=False).count(), 5)
        self.assertEqual(application.photos.count(), 1)
        self.assertFalse(Business.objects.exists())
        notify.assert_called_once_with(application)

    def test_duplicate_pending_application_returns_conflict(self):
        first = self.client.post('/api/business-applications', self.data(), format='multipart')
        second = self.client.post('/api/business-applications', self.data(), format='multipart')
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 409, second.content)
        self.assertEqual(BusinessApplication.objects.count(), 1)

    def test_invalid_hours_rejected_without_creating_application(self):
        data = self.data()
        data['close_time'] = '08:00'
        response = self.client.post('/api/business-applications', data, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(BusinessApplication.objects.exists())

    def test_fake_image_rejected(self):
        data = self.data()
        data['photos'] = [SimpleUploadedFile('fake.png', b'not an image', content_type='image/png')]
        response = self.client.post('/api/business-applications', data, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_seven_photos_rejected(self):
        data = self.data()
        data['photos'] = [self.data()['photos'][0] for _ in range(7)]
        response = self.client.post('/api/business-applications', data, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_anonymous_cannot_submit(self):
        self.client.force_authenticate(None)
        response = self.client.post('/api/business-applications', self.data(), format='multipart')
        self.assertEqual(response.status_code, 401)

    def test_users_only_see_their_own_application_status(self):
        application = BusinessApplication.objects.create(applicant=self.user, telegram_chat_id='', name='Mine', status='PENDING')
        BusinessApplication.objects.create(applicant=make_user(), telegram_chat_id='', name='Private', status='PENDING')
        response = self.client.get('/api/business-applications')
        self.assertEqual([item['id'] for item in response.json()], [application.id])

    def test_notification_failure_does_not_lose_submitted_application(self):
        with patch('apps.marketplace.application_views.notify_owner', side_effect=RuntimeError('offline')), self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/api/business-applications', self.data(), format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(BusinessApplication.objects.get().status, BusinessApplicationStatus.PENDING)
