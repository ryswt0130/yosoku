from django.db import models
from django.contrib.auth.models import User
from django.conf import settings

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('producer', 'Producer'),
        ('consumer', 'Consumer'),
    ]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"

class ProducerProfile(models.Model):
    user_profile = models.OneToOneField(UserProfile, on_delete=models.CASCADE, related_name='producer_details')
    business_name = models.CharField(max_length=255, blank=True, null=True)
    address_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Latitude of the producer's base location")
    address_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="Longitude of the producer's base location")
    delivery_radius_km = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Delivery radius in kilometers")
    bio = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Producer: {self.user_profile.user.username}"

class Product(models.Model):
    RICE_TYPE_CHOICES = [
        ('hakumai', '白米 (Hakumai - White Rice)'),
        ('genmai', '玄米 (Genmai - Brown Rice)'),
        ('mochigome', 'もち米 (Mochigome - Glutinous Rice)'),
        ('koshihikari', 'コシヒカリ (Koshihikari)'),
        ('akitakomachi', 'あきたこまち (Akitakomachi)'),
        ('hitomebore', 'ひとめぼれ (Hitomebore)'),
        ('others', 'その他 (Others)'),
    ]
    producer_profile = models.ForeignKey(ProducerProfile, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255, help_text="Name of the rice product, e.g., 'Niigata Koshihikari'")
    description = models.TextField(blank=True, null=True)
    rice_type = models.CharField(max_length=50, choices=RICE_TYPE_CHOICES, default='hakumai')
    quantity_kg = models.DecimalField(max_digits=7, decimal_places=2, help_text="Amount of rice available in kilograms")
    price_yen_per_kg = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price in Yen per kilogram")
    image = models.ImageField(upload_to='product_images/', blank=True, null=True)
    available = models.BooleanField(default=True, help_text="Is this product currently available for purchase?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} by {self.producer_profile.user_profile.user.username}"

class DeliveryAddress(models.Model):
    user_profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='delivery_addresses')
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100)
    prefecture = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=50, default="Japan")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user_profile.user.username} - {self.address_line1}, {self.city}"

class Order(models.Model):
    ORDER_STATUS_CHOICES = [
        ('pending_confirmation', 'Pending Confirmation'),
        ('confirmed_by_producer', 'Confirmed by Producer'),
        ('awaiting_payment', 'Awaiting Payment'), # If implementing a separate payment step
        ('paid', 'Paid'),
        ('out_for_delivery', 'Out for Delivery'),
        ('delivered', 'Delivered'),
        ('completed', 'Completed'), # After delivery and consumer confirmation perhaps
        ('cancelled_by_consumer', 'Cancelled by Consumer'),
        ('cancelled_by_producer', 'Cancelled by Producer'),
    ]
    consumer_profile = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='orders_placed', limit_choices_to={'role': 'consumer'})
    # Storing producer directly on the order for easier querying, even though it can be derived via OrderItem -> Product -> ProducerProfile
    producer_profile = models.ForeignKey(ProducerProfile, on_delete=models.SET_NULL, null=True, related_name='orders_received')

    # Delivery address details at the time of order
    delivery_address_snapshot = models.TextField(help_text="Snapshot of the delivery address at the time of order")

    total_price_yen = models.DecimalField(max_digits=10, decimal_places=2)
    order_status = models.CharField(max_length=30, choices=ORDER_STATUS_CHOICES, default='pending_confirmation')

    notes_by_consumer = models.TextField(blank=True, null=True)
    notes_by_producer = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order #{self.id} by {self.consumer_profile.user.username if self.consumer_profile else 'N/A'}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, help_text="Product linked to this item. Null if product deleted.")
    product_name_snapshot = models.CharField(max_length=255, help_text="Snapshot of product name at time of order")
    quantity_kg = models.DecimalField(max_digits=7, decimal_places=2, help_text="Quantity of this product in kilograms for this order item")
    price_yen_per_kg_snapshot = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price per kg at the time of order")
    total_price_yen = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total price for this order item (quantity * price_per_kg)")

    def __str__(self):
        return f"{self.quantity_kg}kg of {self.product_name_snapshot} for Order #{self.order.id}"

    def save(self, *args, **kwargs):
        if self.product: # Ensure product is set before trying to access its attributes
            self.product_name_snapshot = self.product.name
            # Assuming price_yen_per_kg_snapshot is set at creation time based on product's current price
        self.total_price_yen = self.quantity_kg * self.price_yen_per_kg_snapshot
        super().save(*args, **kwargs)

# Notification Model
class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('new_order', 'New Order Received'),
        ('order_update', 'Order Status Updated'),
        ('general_info', 'General Information'),
        # Add more types as needed
    ]
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES, default='general_info')
    # Optional: Link to related object using GenericForeignKey or simple URL/ID
    related_object_url = models.CharField(max_length=255, blank=True, null=True, help_text="A URL to the related object, e.g., order detail page.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True) # For when it's marked as read

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.message[:30]}..."
