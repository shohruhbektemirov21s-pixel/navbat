from rest_framework import permissions
from .models import UserRole


class IsFounderOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in [UserRole.FOUNDER, UserRole.ADMIN]
        )


class IsOperatingPartner(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in [UserRole.OPERATING_PARTNER, UserRole.FOUNDER, UserRole.ADMIN]
        )


class IsBusinessOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in [UserRole.BUSINESS_OWNER, UserRole.FOUNDER, UserRole.ADMIN]
        )


class IsStaffOrOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in [
                UserRole.BUSINESS_OWNER,
                UserRole.STAFF,
                UserRole.EMPLOYEE,
                UserRole.FOUNDER,
                UserRole.ADMIN
            ]
        )
