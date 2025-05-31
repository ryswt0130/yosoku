from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.utils import timezone # For Notification updated_at
from rest_framework import viewsets, permissions, generics, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import UserProfile, ProducerProfile, Product, DeliveryAddress, Order, OrderItem, Notification # Added Notification
from .serializers import (
    UserSerializer, UserProfileSerializer, ProducerProfileSerializer,
    ProductSerializer, ProductImageSerializer, DeliveryAddressSerializer,
    OrderSerializer, OrderItemReadSerializer, NotificationSerializer # Added NotificationSerializer
)
from .permissions import IsOwnerOrReadOnly, IsProducerUser, IsConsumerUser, IsOrderObjectOwner, CanUpdateOrderStatus
from .utils import haversine
import logging

logger = logging.getLogger(__name__)

class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        profile_data = self.request.data.get('profile', {})
        role = profile_data.get('role', 'consumer')
        user_profile = UserProfile.objects.create(user=user, role=role)
        if role == 'producer': ProducerProfile.objects.create(user_profile=user_profile)

class ProducerProfileViewSet(viewsets.ModelViewSet):
    queryset = ProducerProfile.objects.all()
    serializer_class = ProducerProfileSerializer
    def get_permissions(self):
        if self.action in ['retrieve', 'list']: return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsProducerUser(), IsOwnerOrReadOnly()]
    def get_queryset(self):
        if self.action == 'list': return ProducerProfile.objects.all()
        if self.request.user.is_authenticated and hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'producer':
            if self.kwargs.get('pk'): return ProducerProfile.objects.filter(user_profile__user=self.request.user, pk=self.kwargs.get('pk'))
            return ProducerProfile.objects.filter(user_profile__user=self.request.user)
        return ProducerProfile.objects.all()
    def perform_update(self, serializer): serializer.save()

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().filter(available=True).order_by('-created_at')
    serializer_class = ProductSerializer
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'my_products', 'upload_image']:
            return [permissions.IsAuthenticated(), IsProducerUser()]
        return [permissions.AllowAny()]
    def get_queryset(self):
        queryset = Product.objects.select_related('producer_profile__user_profile__user').filter(available=True)
        producer_id_param = self.request.query_params.get('producer_id')
        if producer_id_param: queryset = queryset.filter(producer_profile_id=producer_id_param)
        search_term = self.request.query_params.get('search')
        if search_term: queryset = queryset.filter(name__icontains=search_term)
        rice_type_param = self.request.query_params.get('rice_type')
        if rice_type_param: queryset = queryset.filter(rice_type=rice_type_param)
        user_lat_str, user_lon_str = self.request.query_params.get('user_lat'), self.request.query_params.get('user_lon')
        if user_lat_str and user_lon_str:
            try:
                user_lat, user_lon = float(user_lat_str), float(user_lon_str)
                product_ids_in_range = []
                for product in queryset.all():
                    pp = product.producer_profile
                    if pp.address_latitude and pp.address_longitude and pp.delivery_radius_km:
                        dist = haversine(user_lat, user_lon, float(pp.address_latitude), float(pp.address_longitude))
                        if dist <= float(pp.delivery_radius_km): product_ids_in_range.append(product.id)
                logger.info(f"Products in range ({len(product_ids_in_range)}) for user at ({user_lat}, {user_lon})")
                queryset = queryset.filter(id__in=product_ids_in_range)
            except ValueError: logger.warning("Invalid lat/lon for geo filtering.")
            except Exception as e: logger.error(f"Geo filtering error: {e}")
        if self.action == 'my_products' and self.request.user.is_authenticated and hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'producer':
            producer_profile_instance = ProducerProfile.objects.filter(user_profile__user=self.request.user).first()
            if producer_profile_instance: return Product.objects.filter(producer_profile=producer_profile_instance).order_by('-created_at')
        return queryset.order_by('-created_at')
    def perform_create(self, serializer):
        producer_profile = ProducerProfile.objects.get(user_profile__user=self.request.user)
        serializer.save(producer_profile=producer_profile)
    def get_object(self):
        obj = super().get_object()
        if self.action in ['update', 'partial_update', 'destroy', 'upload_image']: self.check_object_permissions(self.request, obj)
        return obj
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsProducerUser])
    def my_products(self, request):
        producer_profile = ProducerProfile.objects.get(user_profile__user=request.user)
        products = Product.objects.filter(producer_profile=producer_profile).order_by('-created_at')
        page = self.paginate_queryset(products)
        if page is not None: return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(products, many=True).data)
    @action(detail=True, methods=['post'], serializer_class=ProductImageSerializer, permission_classes=[permissions.IsAuthenticated, IsProducerUser, IsOwnerOrReadOnly])
    def upload_image(self, request, pk=None):
        product = self.get_object()
        serializer = self.get_serializer(product, data=request.data)
        if serializer.is_valid():
            serializer.save(); return Response(ProductSerializer(product).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DeliveryAddressViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    def get_queryset(self): return DeliveryAddress.objects.filter(user_profile__user=self.request.user)
    def perform_create(self, serializer):
        user_profile = UserProfile.objects.get(user=self.request.user)
        serializer.save(user_profile=user_profile)

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrderObjectOwner]
    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile: return Order.objects.none()
        qs = Order.objects.all().prefetch_related('items__product__producer_profile__user_profile', 'consumer_profile__user', 'producer_profile__user_profile__user').order_by('-created_at')
        if profile.role == 'consumer': return qs.filter(consumer_profile=profile)
        if profile.role == 'producer':
            producer_details = getattr(profile, 'producer_details', None)
            if producer_details: return qs.filter(producer_profile=producer_details)
        if user.is_staff: return qs
        return Order.objects.none()
    def get_serializer_context(self): return {'request': self.request, 'view': self}
    @transaction.atomic
    def perform_create(self, serializer): serializer.save()
    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated, IsOrderObjectOwner, CanUpdateOrderStatus])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('order_status')
        if not new_status: return Response({'error': 'order_status is required.'}, status=status.HTTP_400_BAD_REQUEST)
        original_status = order.order_status
        order.order_status = new_status
        try:
            if new_status == 'confirmed_by_producer' and original_status == 'pending_confirmation':
                for item in order.items.all():
                    if item.product.quantity_kg < item.quantity_kg:
                        raise ValueError(f"Not enough stock for {item.product.name}.")
                    item.product.quantity_kg -= item.quantity_kg
                    item.product.save()
            elif new_status == 'cancelled_by_producer' and original_status == 'confirmed_by_producer':
                for item in order.items.all():
                    if item.product: item.product.quantity_kg += item.quantity_kg; item.product.save()

            order.save() # Save order status change

            # Create notification for the consumer on status update
            # Ensure consumer_profile and user exist
            if order.consumer_profile and order.consumer_profile.user:
                recipient_user = order.consumer_profile.user
                message = f"Your order #{order.id} status has been updated to: {order.get_order_status_display()}."
                related_url = f"/consumer/orders/{order.id}" # Example frontend URL for consumer
                Notification.objects.create(
                    recipient=recipient_user,
                    message=message,
                    notification_type='order_update',
                    related_object_url=related_url
                )
            return Response(OrderSerializer(order, context=self.get_serializer_context()).data)
        except ValueError as e:
             logger.warning(f"ValueError: {str(e)} for order {order.id}")
             return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating order {order.id} status: {str(e)}")
            return Response({'error': "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class OrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemReadSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        user = self.request.user
        if not (user.is_authenticated and hasattr(user, 'profile')): return OrderItem.objects.none()
        if user.profile.role == 'consumer': return OrderItem.objects.filter(order__consumer_profile=user.profile)
        elif user.profile.role == 'producer' and hasattr(user.profile, 'producer_details'):
            return OrderItem.objects.filter(order__producer_profile=user.profile.producer_details)
        if user.is_staff: return OrderItem.objects.all()
        return OrderItem.objects.none()

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self): return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')
    @action(detail=False, methods=['post'], url_path='mark-as-read')
    def mark_notifications_as_read(self, request):
        notification_ids = request.data.get('ids', [])
        if not notification_ids: # Mark all as read if no IDs provided
            Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True, updated_at=timezone.now())
            return Response({'status': 'all notifications marked as read'}, status=status.HTTP_200_OK)
        try: notification_ids = [int(id_str) for id_str in notification_ids]
        except ValueError: return Response({'error': 'Invalid IDs.'}, status=status.HTTP_400_BAD_REQUEST)
        updated_count = Notification.objects.filter(recipient=request.user, id__in=notification_ids, is_read=False).update(is_read=True, updated_at=timezone.now())
        return Response({'status': f'{updated_count} marked as read'}, status=status.HTTP_200_OK)
    def perform_update(self, serializer): # For PATCH to /notifications/{id}/ to mark one as read
        if 'is_read' in serializer.validated_data and len(serializer.validated_data) == 1:
            if serializer.instance.recipient == self.request.user: # Check ownership
                serializer.save(updated_at=timezone.now())
            else: raise permissions.PermissionDenied("Cannot update this notification.")
        else: raise serializers.ValidationError("Only 'is_read' can be updated this way.") # Using serializers.ValidationError from rest_framework
    def perform_destroy(self, instance): # Allow user to delete their own notifications
        if instance.recipient == self.request.user: super().perform_destroy(instance)
        else: raise permissions.PermissionDenied("Cannot delete this notification.")
