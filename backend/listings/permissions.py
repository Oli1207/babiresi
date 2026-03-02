from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return getattr(obj, "author_id", None) == getattr(request.user, "id", None)

# =========================================================
# ✅ NEW: Roles admin (sans Django admin)
# =========================================================

def _in_group(user, name: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user.groups.filter(name=name).exists()


class IsAdminDashboard(BasePermission):
    """Accès total au dashboard interne."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.is_staff or _in_group(user, "ADMIN"))
        )


class IsSupportDashboard(BasePermission):
    """Support: litiges + lecture + override limité (selon les views)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or _in_group(user, "SUPPORT") or _in_group(user, "ADMIN"))
        )


class IsPayoutManager(BasePermission):
    """Accès reversements uniquement."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or _in_group(user, "PAYOUT_MANAGER") or _in_group(user, "ADMIN"))
        )