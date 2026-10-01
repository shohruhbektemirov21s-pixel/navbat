from rest_framework import permissions

from .models import UserRole

ADMIN_ROLES = (UserRole.FOUNDER, UserRole.ADMIN)
PARTNER_ROLES = (UserRole.OPERATING_PARTNER, UserRole.SALES_MANAGER, UserRole.ADMIN, UserRole.FOUNDER)
SUPPORT_STAFF_ROLES = (UserRole.SUPPORT, UserRole.OPERATING_PARTNER, UserRole.ADMIN, UserRole.FOUNDER)


def has_role(user, roles):
    return bool(user and user.is_authenticated and user.role in roles)


class RolePermission(permissions.BasePermission):
    roles = ()
    message = 'Ushbu bo‘limga kirish uchun ruxsatingiz yo‘q.'

    def has_permission(self, request, view):
        return has_role(request.user, self.roles)


class IsFounderOrAdmin(RolePermission):
    roles = ADMIN_ROLES
    message = 'Bu amal faqat administratorlar uchun.'


class IsFounder(RolePermission):
    roles = (UserRole.FOUNDER,)
    message = 'Bu amal faqat Founder uchun.'


class IsOperatingPartner(RolePermission):
    """Partner-side staff: operating partner, sales manager and platform admins."""
    roles = PARTNER_ROLES
    message = 'Bu bo‘lim faqat hamkorlar jamoasi uchun.'


class IsSupportStaff(RolePermission):
    roles = SUPPORT_STAFF_ROLES
