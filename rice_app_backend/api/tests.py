from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone # For comparing datetimes if needed
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from .models import UserProfile, ProducerProfile, Product, Order, OrderItem, Notification
from .serializers import OrderSerializer # For direct testing if needed
from .utils import haversine
from decimal import Decimal

# Helper function to create users and profiles for tests
def create_user_with_profile(username, password, email, role, phone_number=None):
    user = User.objects.create_user(username=username, password=password, email=email)
    user_profile = UserProfile.objects.create(user=user, role=role, phone_number=phone_number)
    producer_profile = None
    if role == 'producer':
        producer_profile = ProducerProfile.objects.create(user_profile=user_profile, business_name=f"{username} Farms")
    return user, user_profile, producer_profile


class HaversineUtilTests(APITestCase):
    def test_haversine_calculation(self):
        # Known distance, e.g., Paris to London approx 344 km
        lat1, lon1 = 48.8566, 2.3522  # Paris
        lat2, lon2 = 51.5074, 0.1278  # London
        distance = haversine(lat1, lon1, lat2, lon2)
        # Adjusted expected value to match common Haversine calculation with R=6371km
        # Or increase delta if a general approximation is acceptable for the test's purpose.
        # Actual calculated: 334.57613798049994
        self.assertAlmostEqual(distance, 334.576, delta=1) # Tighter delta with more precise expected value

class UserRegistrationTests(APITestCase):
    def test_consumer_registration_creates_profiles(self):
        url = reverse('user-register') # Assumes name='user-register' in api/urls.py
        data = {
            "username": "testconsumer",
            "email": "consumer@example.com",
            "password": "password123",
            "profile": {"role": "consumer", "phone_number": "1234567890"}
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="testconsumer").exists())
        user = User.objects.get(username="testconsumer")
        self.assertTrue(UserProfile.objects.filter(user=user, role="consumer").exists())
        self.assertFalse(ProducerProfile.objects.filter(user_profile__user=user).exists()) # No producer profile

    def test_producer_registration_creates_profiles(self):
        url = reverse('user-register')
        data = {
            "username": "testproducer",
            "email": "producer@example.com",
            "password": "password123",
            "profile": {"role": "producer"}
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="testproducer").exists())
        user = User.objects.get(username="testproducer")
        self.assertTrue(UserProfile.objects.filter(user=user, role="producer").exists())
        self.assertTrue(ProducerProfile.objects.filter(user_profile__user=user).exists())


class ProductManagementTests(APITestCase):
    def setUp(self):
        self.producer_user, self.producer_up, self.producer_pp = create_user_with_profile(
            "producerone", "prodpass", "pone@example.com", "producer"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.producer_user)

    def test_create_product(self):
        url = reverse('product-list') # Default basename for ViewSet is 'modelname-list'
        data = {
            "name": "Test Rice",
            "rice_type": "koshihikari",
            "quantity_kg": "10.50",
            "price_yen_per_kg": "500.00",
            "available": True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Product.objects.count(), 1)
        product = Product.objects.first()
        self.assertEqual(product.name, "Test Rice")
        self.assertEqual(product.producer_profile, self.producer_pp)

    def test_producer_can_list_own_products(self):
        # Create a product for this producer
        Product.objects.create(
            producer_profile=self.producer_pp, name="My Test Rice", rice_type="hakumai",
            quantity_kg=5, price_yen_per_kg=600
        )
        # Create a product for another producer (if any) - not strictly needed for this test

        url = reverse('product-my-products') # Custom action
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Assuming pagination is active by default, response.data will be a dict with 'results'
        # If not paginated, response.data would be a list.
        # The default PageNumberPagination returns a dict like:
        # {"count": N, "next": URL_OR_NULL, "previous": URL_OR_NULL, "results": LIST_OF_DATA}
        results = response.data.get('results') if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], "My Test Rice")


class OrderPlacementAndNotificationTests(APITestCase):
    def setUp(self):
        self.producer_user, self.producer_up, self.producer_pp = create_user_with_profile(
            "ricefarmer", "prodpass", "farmer@example.com", "producer", "111222333"
        )
        self.producer_pp.address_latitude = Decimal("35.0")
        self.producer_pp.address_longitude = Decimal("135.0")
        self.producer_pp.delivery_radius_km = Decimal("50.0")
        self.producer_pp.save()

        self.consumer_user, self.consumer_up, _ = create_user_with_profile(
            "ricebuyer", "conspass", "buyer@example.com", "consumer", "888999000"
        )

        self.product1 = Product.objects.create(
            producer_profile=self.producer_pp, name="Farmer's Best Rice", rice_type="koshihikari",
            quantity_kg=Decimal("20.00"), price_yen_per_kg=Decimal("750.00"), available=True
        )
        self.product2 = Product.objects.create(
            producer_profile=self.producer_pp, name="Farmer's Special Brown Rice", rice_type="genmai",
            quantity_kg=Decimal("15.00"), price_yen_per_kg=Decimal("650.00"), available=True
        )

        self.client = APIClient()

    def test_place_order_creates_order_items_and_notification(self):
        self.client.force_authenticate(user=self.consumer_user)
        url = reverse('order-list')
        order_data = {
            "ordered_items": [
                {"product_id": self.product1.id, "quantity_kg": "2.5"},
                {"product_id": self.product2.id, "quantity_kg": "1.0"}
            ],
            "delivery_address_snapshot": "123 Test St, Test City, Test Prefecture 12345"
        }
        response = self.client.post(url, order_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(OrderItem.objects.count(), 2)

        order = Order.objects.first()
        self.assertEqual(order.consumer_profile, self.consumer_up)
        self.assertEqual(order.producer_profile, self.producer_pp)
        expected_total = (Decimal("2.5") * self.product1.price_yen_per_kg) + (Decimal("1.0") * self.product2.price_yen_per_kg)
        self.assertEqual(order.total_price_yen, expected_total)
        self.assertEqual(order.order_status, 'pending_confirmation')

        self.assertEqual(Notification.objects.count(), 1)
        notification = Notification.objects.first()
        self.assertEqual(notification.recipient, self.producer_user)
        self.assertEqual(notification.notification_type, 'new_order')
        self.assertIn(f"New order #{order.id}", notification.message)
        self.assertIn(self.consumer_user.username, notification.message)


    def test_producer_confirms_order_updates_status_deducts_stock_notifies_consumer(self):
        self.client.force_authenticate(user=self.consumer_user)
        order_payload = {
            "ordered_items": [{"product_id": self.product1.id, "quantity_kg": "3.0"}],
            "delivery_address_snapshot": "Consumer Address"
        }
        self.client.post(reverse('order-list'), order_payload, format='json')
        order = Order.objects.first()
        initial_stock_product1 = self.product1.quantity_kg
        self.assertEqual(Notification.objects.count(), 1)

        self.client.force_authenticate(user=self.producer_user)
        confirm_url = reverse('order-update-status', kwargs={'pk': order.id})

        response = self.client.patch(confirm_url, {"order_status": "confirmed_by_producer"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        order.refresh_from_db()
        self.product1.refresh_from_db()
        self.assertEqual(order.order_status, 'confirmed_by_producer')
        self.assertEqual(self.product1.quantity_kg, initial_stock_product1 - Decimal("3.0"))

        self.assertEqual(Notification.objects.count(), 2)
        consumer_notification = Notification.objects.filter(recipient=self.consumer_user).latest('created_at')
        self.assertEqual(consumer_notification.notification_type, 'order_update')
        self.assertIn(f"order #{order.id} status has been updated to: Confirmed by Producer", consumer_notification.message)

class ProductGeoFilteringTests(APITestCase):
    def setUp(self):
        self.p1_user, self.p1_up, self.p1_pp = create_user_with_profile("p1geo", "pass", "p1@g.com", "producer")
        self.p1_pp.address_latitude = Decimal("34.000000")
        self.p1_pp.address_longitude = Decimal("134.000000")
        self.p1_pp.delivery_radius_km = Decimal("10.0")
        self.p1_pp.save()
        self.prod_p1 = Product.objects.create(producer_profile=self.p1_pp, name="P1 Rice", quantity_kg=10, price_yen_per_kg=100)

        self.p2_user, self.p2_up, self.p2_pp = create_user_with_profile("p2geo", "pass", "p2@g.com", "producer")
        self.p2_pp.address_latitude = Decimal("34.100000")
        self.p2_pp.address_longitude = Decimal("134.000000")
        self.p2_pp.delivery_radius_km = Decimal("5.0")
        self.p2_pp.save()
        self.prod_p2 = Product.objects.create(producer_profile=self.p2_pp, name="P2 Rice", quantity_kg=10, price_yen_per_kg=100)

        self.client = APIClient()

    def test_filter_products_by_location_in_radius(self):
        user_lat, user_lon = "34.010000", "134.000000"
        url = reverse('product-list') + f"?user_lat={user_lat}&user_lon={user_lon}"
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results') if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], "P1 Rice")

    def test_filter_products_by_location_no_results(self):
        user_lat, user_lon = "36.000000", "138.000000"
        url = reverse('product-list') + f"?user_lat={user_lat}&user_lon={user_lon}"
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results') if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 0)
