from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import viewsets, permissions, generics, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import UserProfile, ProducerProfile, Product, DeliveryAddress, Order, OrderItem
from .serializers import (
    UserSerializer, UserProfileSerializer, ProducerProfileSerializer,
    ProductSerializer, ProductImageSerializer, DeliveryAddressSerializer, OrderSerializer, OrderItemReadSerializer
)
from .permissions import IsOwnerOrReadOnly, IsProducerUser, IsConsumerUser, IsOrderObjectOwner, CanUpdateOrderStatus

class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        profile_data = self.request.data.get('profile', {})
        role = profile_data.get('role', 'consumer') # Default to consumer

        user_profile = UserProfile.objects.create(user=user, role=role)
        if role == 'producer':
            ProducerProfile.objects.create(user_profile=user_profile)

class ProducerProfileViewSet(viewsets.ModelViewSet):
    queryset = ProducerProfile.objects.all()
    serializer_class = ProducerProfileSerializer

    def get_permissions(self):
        if self.action in ['retrieve', 'list']: return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsProducerUser(), IsOwnerOrReadOnly()]

    def get_queryset(self):
        if self.request.user.is_authenticated and IsProducerUser().has_permission(self.request, self) and self.action != 'list':
             # If it's a detail view by a producer, ensure it's their own profile
            if self.kwargs.get('pk'): # Check if 'pk' is in kwargs for detail view
                return ProducerProfile.objects.filter(user_profile__user=self.request.user, pk=self.kwargs.get('pk'))
            return ProducerProfile.objects.filter(user_profile__user=self.request.user) # For non-list actions on self
        return ProducerProfile.objects.all() # Public listing

    def perform_update(self, serializer):
        # IsOwnerOrReadOnly permission already checks this for object level
        serializer.save()

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().filter(available=True).order_by('-created_at')
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'my_products', 'upload_image']:
            return [permissions.IsAuthenticated(), IsProducerUser()] # IsOwnerOrReadOnly for object level
        return [permissions.AllowAny()] # List and Retrieve are public

    def get_queryset(self):
        queryset = Product.objects.all().order_by('-created_at') # Start with all for 'my_products'
        if self.action != 'my_products': # Filter available for public lists
            queryset = queryset.filter(available=True)

        producer_id = self.request.query_params.get('producer_id')
        if producer_id: queryset = queryset.filter(producer_profile_id=producer_id)

        search_term = self.request.query_params.get('search')
        if search_term: queryset = queryset.filter(name__icontains=search_term)
        return queryset

    def perform_create(self, serializer):
        producer_profile = ProducerProfile.objects.get(user_profile__user=self.request.user)
        serializer.save(producer_profile=producer_profile)

    # IsOwnerOrReadOnly is used for object-level permission on update/destroy
    def get_object(self):
        obj = super().get_object()
        if self.action in ['update', 'partial_update', 'destroy', 'upload_image']: # Check ownership for these actions
            self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsProducerUser])
    def my_products(self, request):
        producer_profile = ProducerProfile.objects.get(user_profile__user=request.user)
        products = self.get_queryset().filter(producer_profile=producer_profile) # Use get_queryset to apply other filters too
        page = self.paginate_queryset(products)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], serializer_class=ProductImageSerializer, permission_classes=[permissions.IsAuthenticated, IsProducerUser, IsOwnerOrReadOnly])
    def upload_image(self, request, pk=None):
        product = self.get_object() # This already checks IsOwnerOrReadOnly via get_object override
        serializer = self.get_serializer(product, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(ProductSerializer(product).data) # Return full product data
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeliveryAddressViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryAddressSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # IsOwnerOrReadOnly checks user_profile

    def get_queryset(self):
        return DeliveryAddress.objects.filter(user_profile__user=self.request.user)

    def perform_create(self, serializer):
        user_profile = UserProfile.objects.get(user=self.request.user)
        serializer.save(user_profile=user_profile)

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrderObjectOwner] # IsOrderObjectOwner for object level

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile: return Order.objects.none()

        qs = Order.objects.all().prefetch_related('items__product__producer_profile__user_profile', 'consumer_profile__user', 'producer_profile__user_profile__user').order_by('-created_at')

        if profile.role == 'consumer': return qs.filter(consumer_profile=profile)
        if profile.role == 'producer':
            producer_details = getattr(profile, 'producer_details', None)
            if producer_details: return qs.filter(producer_profile=producer_details)
        if user.is_staff: return qs # Admin can see all
        return Order.objects.none()

    def get_serializer_context(self):
        return {'request': self.request, 'view': self} # Pass view for hyperlinked serializers if used

    @transaction.atomic
    def perform_create(self, serializer):
        # serializer.create handles the logic, including setting consumer_profile
        serializer.save()

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated, IsOrderObjectOwner, CanUpdateOrderStatus])
    def update_status(self, request, pk=None):
        order = self.get_object() # Checks IsOrderObjectOwner
        # CanUpdateOrderStatus permission checks if user can set the *specific* new_status

        new_status = request.data.get('order_status')
        if not new_status:
            return Response({'error': 'order_status is required.'}, status=status.HTTP_400_BAD_REQUEST)

        original_status = order.order_status
        order.order_status = new_status

        try:
            # Perform stock adjustments if status transition requires it
            if new_status == 'confirmed_by_producer' and original_status == 'pending_confirmation':
                for item in order.items.all():
                    if item.quantity_kg > item.product.quantity_kg:
                        raise ValueError(f"Not enough stock for {item.product.name}. Available: {item.product.quantity_kg}kg.")
                    item.product.quantity_kg -= item.quantity_kg
                    item.product.save()
            elif new_status == 'cancelled_by_producer' and original_status == 'confirmed_by_producer':
                # Return stock if producer cancels a confirmed order
                for item in order.items.all():
                    item.product.quantity_kg += item.quantity_kg
                    item.product.save()
            # Consumer cancellation ('cancelled_by_consumer') from 'pending_confirmation' does not need stock adjustment
            # as stock was not deducted yet.

            order.save()
            return Response(OrderSerializer(order, context=self.get_serializer_context()).data)
        except ValueError as e:
             return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: # Catch any other unexpected error
            return Response({'error': f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ReadOnly OrderItem ViewSet, as items are managed via Order
class OrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemReadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_authenticated and hasattr(user, 'profile')): return OrderItem.objects.none()

        # Consumers see items from their orders, Producers see items from orders to them
        if user.profile.role == 'consumer':
            return OrderItem.objects.filter(order__consumer_profile=user.profile)
        elif user.profile.role == 'producer' and hasattr(user.profile, 'producer_details'):
            return OrderItem.objects.filter(order__producer_profile=user.profile.producer_details)
        if user.is_staff: return OrderItem.objects.all()
        return OrderItem.objects.none()
