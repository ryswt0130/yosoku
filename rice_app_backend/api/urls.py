from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    UserCreateView, ProducerProfileViewSet, ProductViewSet,
    DeliveryAddressViewSet, OrderViewSet, OrderItemViewSet
)

router = DefaultRouter()
router.register(r'producers', ProducerProfileViewSet, basename='producerprofile') # Changed from producerprofiles
router.register(r'products', ProductViewSet, basename='product')
router.register(r'addresses', DeliveryAddressViewSet, basename='deliveryaddress') # Changed from deliveryaddresses
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'orderitems', OrderItemViewSet, basename='orderitem') # Read-only access to items

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', UserCreateView.as_view(), name='user-register'),
    path('auth/login/', obtain_auth_token, name='api-token-auth'),
]
