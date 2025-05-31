from rest_framework import permissions
from .models import UserProfile

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if hasattr(obj, 'user') and obj.user == request.user: return True
        if hasattr(obj, 'user_profile') and obj.user_profile.user == request.user: return True
        if hasattr(obj, 'producer_profile') and hasattr(obj.producer_profile, 'user_profile') and obj.producer_profile.user_profile.user == request.user: return True
        if hasattr(obj, 'consumer_profile') and obj.consumer_profile.user == request.user: return True # For Order consumer
        return False

class IsProducerUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated and
                hasattr(request.user, 'profile') and request.user.profile.role == 'producer')

class IsConsumerUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated and
                hasattr(request.user, 'profile') and request.user.profile.role == 'consumer')

class IsOrderObjectOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj): # obj is an Order instance
        if not (request.user and request.user.is_authenticated and hasattr(request.user, 'profile')):
            return False
        profile = request.user.profile
        # Consumer who placed the order
        if profile == obj.consumer_profile:
            return True
        # Producer to whom the order is placed
        if profile.role == 'producer' and hasattr(profile, 'producer_details') and profile.producer_details == obj.producer_profile:
            return True
        return False

class CanUpdateOrderStatus(permissions.BasePermission):
    def has_object_permission(self, request, view, obj): # obj is an Order instance
        if not (request.user and request.user.is_authenticated and hasattr(request.user, 'profile')):
            return False
        profile = request.user.profile
        new_status = request.data.get('order_status')

        if profile.role == 'producer' and hasattr(profile, 'producer_details') and profile.producer_details == obj.producer_profile:
            # Producers can move to confirmed, out_for_delivery, delivered, cancelled_by_producer
            return new_status in ['confirmed_by_producer', 'out_for_delivery', 'delivered', 'cancelled_by_producer']

        if profile == obj.consumer_profile:
            # Consumers can only cancel if order is pending confirmation
            return new_status == 'cancelled_by_consumer' and obj.order_status == 'pending_confirmation'
        return False
