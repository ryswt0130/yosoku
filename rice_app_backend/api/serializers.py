from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, ProducerProfile, Product, DeliveryAddress, Order, OrderItem, Notification # Added Notification

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'phone_number']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'profile']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data.pop('profile', None)
        user = User.objects.create_user(**validated_data)
        return user

class ProducerProfileSerializer(serializers.ModelSerializer):
    user_profile_username = serializers.CharField(source='user_profile.user.username', read_only=True)
    email = serializers.EmailField(source='user_profile.user.email', read_only=True)
    class Meta:
        model = ProducerProfile
        fields = ['id', 'user_profile', 'user_profile_username', 'email', 'business_name', 'address_latitude', 'address_longitude', 'delivery_radius_km', 'bio']
        read_only_fields = ['user_profile']

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['image']

class ProductSerializer(serializers.ModelSerializer):
    producer_profile_username = serializers.CharField(source='producer_profile.user_profile.user.username', read_only=True)
    class Meta:
        model = Product
        fields = [
            'id', 'producer_profile', 'producer_profile_username', 'name', 'description',
            'rice_type', 'quantity_kg', 'price_yen_per_kg', 'image', 'available',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['producer_profile']

class DeliveryAddressSerializer(serializers.ModelSerializer):
    user_profile_username = serializers.CharField(source='user_profile.user.username', read_only=True)
    class Meta:
        model = DeliveryAddress
        fields = [
            'id', 'user_profile', 'user_profile_username', 'address_line1', 'address_line2', 'city',
            'prefecture', 'postal_code', 'country', 'is_default',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['user_profile']

class OrderItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(available=True), source='product', help_text="ID of the product to order.")
    class Meta:
        model = OrderItem
        fields = ['product_id', 'quantity_kg']

class OrderItemReadSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name_snapshot', 'quantity_kg',
            'price_yen_per_kg_snapshot', 'total_price_yen'
        ]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)
    ordered_items = OrderItemWriteSerializer(many=True, write_only=True, help_text="List of items to include in the order. Each item needs 'product_id' and 'quantity_kg'.")
    consumer_username = serializers.CharField(source='consumer_profile.user.username', read_only=True)
    producer_username = serializers.CharField(source='producer_profile.user_profile.user.username', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'consumer_profile', 'consumer_username', 'producer_profile', 'producer_username',
            'delivery_address_snapshot', 'total_price_yen', 'order_status',
            'notes_by_consumer', 'notes_by_producer', 'items', 'ordered_items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['consumer_profile', 'producer_profile', 'total_price_yen', 'order_status', 'items']

    def create(self, validated_data):
        ordered_items_data = validated_data.pop('ordered_items')
        request_user_profile = self.context['request'].user.profile
        if request_user_profile.role != 'consumer':
            raise serializers.ValidationError("Only consumers can place orders.")
        validated_data['consumer_profile'] = request_user_profile

        if not ordered_items_data: raise serializers.ValidationError("Order must contain at least one item.")

        first_product_instance = ordered_items_data[0]['product']
        producer_profile_instance = first_product_instance.producer_profile
        validated_data['producer_profile'] = producer_profile_instance

        delivery_address_qs = DeliveryAddress.objects.filter(user_profile=request_user_profile, is_default=True)
        default_address = delivery_address_qs.first() or DeliveryAddress.objects.filter(user_profile=request_user_profile).first()
        if default_address:
            validated_data['delivery_address_snapshot'] = f"{default_address.address_line1}, {default_address.address_line2 or ''}, {default_address.city}, {default_address.prefecture} {default_address.postal_code}"
        else:
            validated_data['delivery_address_snapshot'] = validated_data.get('delivery_address_snapshot', "No address provided by user and none on file.")

        validated_data['order_status'] = Order.ORDER_STATUS_CHOICES[0][0]
        order = Order(**validated_data)
        calculated_total_order_price = 0
        order_items_to_create = []

        for item_data in ordered_items_data:
            product_instance = item_data['product']
            quantity = item_data['quantity_kg']
            if product_instance.producer_profile != producer_profile_instance:
                raise serializers.ValidationError({"ordered_items": "All items must be from the same producer."})
            if not product_instance.available:
                raise serializers.ValidationError({"ordered_items": f"Product '{product_instance.name}' is not available."})
            if quantity <= 0: raise serializers.ValidationError({"ordered_items": "Quantity must be positive."})

            item_total_price = quantity * product_instance.price_yen_per_kg
            order_items_to_create.append(OrderItem(
                order=order, product=product_instance, quantity_kg=quantity,
                price_yen_per_kg_snapshot=product_instance.price_yen_per_kg,
                product_name_snapshot=product_instance.name, total_price_yen=item_total_price
            ))
            calculated_total_order_price += item_total_price

        order.total_price_yen = calculated_total_order_price
        order.save()
        for item_to_create in order_items_to_create:
            item_to_create.order = order
            item_to_create.save()

        # Create notification for the producer
        if producer_profile_instance and producer_profile_instance.user_profile:
            recipient_user = producer_profile_instance.user_profile.user
            message = f"New order #{order.id} received from {order.consumer_profile.user.username} for ¥{order.total_price_yen}."
            related_url = f"/producer/orders/{order.id}" # Example frontend URL
            Notification.objects.create(
                recipient=recipient_user,
                message=message,
                notification_type='new_order',
                related_object_url=related_url
            )
        return order

class NotificationSerializer(serializers.ModelSerializer):
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    class Meta:
        model = Notification
        fields = ['id', 'recipient_username', 'message', 'is_read',
                  'notification_type', 'related_object_url', 'created_at', 'updated_at']
        read_only_fields = ['recipient_username', 'message',
                            'notification_type', 'related_object_url', 'created_at']
        # 'is_read' can be updated by user. 'recipient' is implicit.
