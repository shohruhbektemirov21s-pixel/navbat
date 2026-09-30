from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from django.utils.text import slugify

from .models import Category, City, Business, Service, Staff, BusinessHours, Review, SavedBusiness
from .serializers import (
    CategorySerializer, CitySerializer, ServiceSerializer,
    StaffSerializer, BusinessHoursSerializer, ReviewSerializer,
    BusinessListSerializer
)
from apps.authentication.permissions import IsBusinessOwner, IsFounderOrAdmin
from apps.authentication.models import UserRole
from apps.core.models import log_audit


class CategoryListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        categories = Category.objects.filter(active=True)
        return Response(CategorySerializer(categories, many=True).data)


class CityListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cities = City.objects.all()
        return Response(CitySerializer(cities, many=True).data)


class BusinessListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        category = request.query_params.get('category', '').strip()
        city = request.query_params.get('city', '').strip()
        sort = request.query_params.get('sort', 'popular')
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')

        user_lat = float(lat) if lat else None
        user_lng = float(lng) if lng else None

        qs = Business.objects.filter(status='APPROVED').select_related('category', 'city')

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(address__icontains=q))
        if category and category != 'all':
            qs = qs.filter(Q(category__slug=category) | Q(category__id=category))
        if city and city != 'all':
            qs = qs.filter(Q(city__name__icontains=city) | Q(city__id=city))

        total = qs.count()
        offset = (page - 1) * limit
        items = qs[offset:offset + limit]

        serializer = BusinessListSerializer(
            items,
            many=True,
            context={'user_lat': user_lat, 'user_lng': user_lng}
        )

        return Response({
            'items': serializer.data,
            'total': total,
            'page': page,
            'limit': limit,
            'totalPages': max(1, (total + limit - 1) // limit),
            'user_coords': {'lat': user_lat, 'lng': user_lng} if user_lat and user_lng else None
        })


class BusinessDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        biz = Business.objects.filter(Q(slug=slug) | Q(id=slug)).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi.'}, status=404)

        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        user_lat = float(lat) if lat else None
        user_lng = float(lng) if lng else None

        biz_data = BusinessListSerializer(biz, context={'user_lat': user_lat, 'user_lng': user_lng}).data
        services = ServiceSerializer(biz.services.filter(is_active=True), many=True).data
        staff = StaffSerializer(biz.staff.filter(is_active=True), many=True).data
        hours = BusinessHoursSerializer(biz.hours.all().order_by('day_of_week'), many=True).data
        reviews = ReviewSerializer(biz.reviews.all().order_by('-created_at')[:20], many=True).data

        return Response({
            'business': biz_data,
            'services': services,
            'staff': staff,
            'hours': hours,
            'reviews': reviews
        })


class BusinessCurrentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        biz = None
        if user.role in [UserRole.BUSINESS_OWNER, UserRole.ADMIN, UserRole.FOUNDER]:
            biz = Business.objects.filter(owner=user).first()
        if not biz:
            # Check staff
            staff_member = Staff.objects.filter(user=user).first()
            if staff_member:
                biz = staff_member.business

        if not biz:
            # Return first approved business as fallback for demo
            biz = Business.objects.first()

        if not biz:
            return Response({'business': None, 'stats': {}})

        biz_data = BusinessListSerializer(biz).data
        # Compute today's stats
        from apps.bookings.models import Booking
        from apps.queues.models import QueueEntry
        bookings_count = Booking.objects.filter(business=biz).count()
        queue_count = QueueEntry.objects.filter(business=biz).count()

        return Response({
            'business': biz_data,
            'stats': {
                'totalBookings': bookings_count,
                'totalQueues': queue_count,
                'activeServices': biz.services.filter(is_active=True).count(),
                'activeStaff': biz.staff.filter(is_active=True).count()
            }
        })


class BusinessServicesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_biz(self, user):
        biz = Business.objects.filter(owner=user).first()
        if not biz:
            staff = Staff.objects.filter(user=user).first()
            if staff:
                biz = staff.business
        if not biz:
            biz = Business.objects.first()
        return biz

    def get(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response([])
        services = Service.objects.filter(business=biz)
        return Response(ServiceSerializer(services, many=True).data)

    def post(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=400)
        data = request.data
        service = Service.objects.create(
            business=biz,
            name=data.get('name'),
            description=data.get('description', ''),
            price_uzs=int(data.get('price_uzs', 0)),
            duration_minutes=int(data.get('duration_minutes', 30)),
            is_active=True
        )
        return Response(ServiceSerializer(service).data, status=status.HTTP_201_CREATED)


class BusinessServiceDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        Service.objects.filter(id=pk).delete()
        return Response({'success': True})


class BusinessStaffView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_biz(self, user):
        biz = Business.objects.filter(owner=user).first()
        if not biz:
            biz = Business.objects.first()
        return biz

    def get(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response([])
        staff = Staff.objects.filter(business=biz)
        return Response(StaffSerializer(staff, many=True).data)

    def post(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=400)
        data = request.data
        staff = Staff.objects.create(
            business=biz,
            name=data.get('name'),
            title=data.get('title', 'Mutaxassis'),
            phone=data.get('phone', ''),
            avatar_url=data.get('avatar_url', ''),
            is_active=True
        )
        service_ids = data.get('service_ids', [])
        if service_ids:
            services = Service.objects.filter(id__in=service_ids)
            staff.services.set(services)
        return Response(StaffSerializer(staff).data, status=status.HTTP_201_CREATED)


class BusinessHoursView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_biz(self, user):
        biz = Business.objects.filter(owner=user).first()
        return biz or Business.objects.first()

    def get(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response([])
        hours = BusinessHours.objects.filter(business=biz).order_by('day_of_week')
        return Response(BusinessHoursSerializer(hours, many=True).data)

    def put(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=400)
        hours_data = request.data.get('hours', [])
        for h in hours_data:
            BusinessHours.objects.update_or_create(
                business=biz,
                day_of_week=h.get('day_of_week'),
                defaults={
                    'open_time': h.get('open_time', '09:00'),
                    'close_time': h.get('close_time', '18:00'),
                    'is_closed': bool(h.get('is_closed', False)),
                    'break_start': h.get('break_start', ''),
                    'break_end': h.get('break_end', '')
                }
            )
        hours = BusinessHours.objects.filter(business=biz).order_by('day_of_week')
        return Response(BusinessHoursSerializer(hours, many=True).data)


class BusinessProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_biz(self, user):
        return Business.objects.filter(owner=user).first() or Business.objects.first()

    def get(self, request):
        biz = self.get_biz(request.user)
        return Response(BusinessListSerializer(biz).data if biz else {})

    def put(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=400)
        data = request.data
        if 'name' in data:
            biz.name = data['name']
        if 'address' in data:
            biz.address = data['address']
        if 'phone' in data:
            biz.phone = data['phone']
        if 'description' in data:
            biz.description = data['description']
        if 'logo_url' in data:
            biz.logo_url = data['logo_url']
        if 'telegram_chat_id' in data:
            biz.telegram_chat_id = data['telegram_chat_id']
        biz.save()
        return Response(BusinessListSerializer(biz).data)


class BusinessRegisterView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        name = data.get('business_name') or data.get('name')
        if not name:
            return Response({'error': 'Biznes nomi kiritilishi shart.'}, status=400)

        slug = slugify(name)
        if Business.objects.filter(slug=slug).exists():
            import uuid
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"

        cat_id = data.get('category_id') or 'cat-stomatology'
        city_id = data.get('city_id') or 'city-qarshi'
        category = Category.objects.filter(Q(id=cat_id) | Q(slug=cat_id)).first()
        city = City.objects.filter(id=city_id).first()

        biz = Business.objects.create(
            owner=request.user,
            name=name,
            slug=slug,
            category=category or Category.objects.first(),
            city=city or City.objects.first(),
            district=data.get('district', ''),
            address=data.get('address', 'Qarshi shahri'),
            phone=data.get('phone', request.user.phone or ''),
            description=data.get('description', ''),
            status='APPROVED',
            is_verified=True,
            subscription_plan_code=data.get('plan_code', 'PRO')
        )
        return Response(BusinessListSerializer(biz).data, status=status.HTTP_201_CREATED)


class CustomerFavoritesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        saved = SavedBusiness.objects.filter(user=request.user).select_related('business')
        businesses = [s.business for s in saved]
        return Response(BusinessListSerializer(businesses, many=True).data)


class CustomerFavoriteIdsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ids = list(SavedBusiness.objects.filter(user=request.user).values_list('business_id', flat=True))
        return Response(ids)


class CustomerFavoriteToggleView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, business_id):
        saved = SavedBusiness.objects.filter(user=request.user, business_id=business_id).first()
        if saved:
            saved.delete()
            return Response({'isSaved': False})
        else:
            biz = Business.objects.filter(id=business_id).first()
            if biz:
                SavedBusiness.objects.create(user=request.user, business=biz)
            return Response({'isSaved': True})


class ReviewCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        biz_id = data.get('business_id')
        rating = int(data.get('rating', 5))
        comment = data.get('comment', '').strip()

        biz = Business.objects.filter(id=biz_id).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=404)

        review = Review.objects.create(
            business=biz,
            customer=request.user,
            rating=rating,
            comment=comment
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


# Admin Endpoints
class AdminBusinessesListView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        bizs = Business.objects.all().order_by('-created_at')
        return Response(BusinessListSerializer(bizs, many=True).data)


class AdminBusinessStatusUpdateView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, business_id):
        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=404)

        new_status = request.data.get('status')
        is_verified = request.data.get('is_verified')
        if new_status:
            biz.status = new_status
        if is_verified is not None:
            biz.is_verified = bool(is_verified)
        biz.save()
        return Response(BusinessListSerializer(biz).data)
