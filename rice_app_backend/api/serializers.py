from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, ProducerProfile, Product, DeliveryAddress, Order, OrderItem

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
        # Profile creation is handled in UserCreateView's perform_create method
        # to ensure role is correctly assigned and ProducerProfile is made if needed.
        validated_data.pop('profile', None) # Remove profile from user creation data if present
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
    # image = serializers.ImageField(required=False, allow_null=True) # Handled by default ModelSerializer

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
    # quantity_kg is already part of OrderItem model

    class Meta:
        model = OrderItem
        fields = ['product_id', 'quantity_kg']


class OrderItemReadSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True) # Show full product details on read. Renamed from product_detail for clarity.
    # product_name_snapshot = serializers.CharField(read_only=True) # Already in model
    # price_yen_per_kg_snapshot = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True) # Already in model
    # total_price_yen = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True) # Already in model

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name_snapshot', 'quantity_kg',
            'price_yen_per_kg_snapshot', 'total_price_yen'
        ]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True) # For reading the order items
    ordered_items = OrderItemWriteSerializer(many=True, write_only=True, help_text="List of items to include in the order. Each item needs 'product_id' and 'quantity_kg'.") # For creating an order

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

        # Get consumer profile from the authenticated user making the request
        request_user_profile = self.context['request'].user.profile
        if request_user_profile.role != 'consumer':
            raise serializers.ValidationError("Only consumers can place orders.")
        validated_data['consumer_profile'] = request_user_profile

        if not ordered_items_data:
            raise serializers.ValidationError("Order must contain at least one item.")

        # Determine producer from the first item. Assume all items in an order are from the same producer.
        # This should be enforced by the frontend cart logic, but double-check here.
        first_product_instance = ordered_items_data[0]['product']
        producer_profile_instance = first_product_instance.producer_profile
        validated_data['producer_profile'] = producer_profile_instance

        # Set delivery address snapshot
        delivery_address_qs = DeliveryAddress.objects.filter(user_profile=request_user_profile, is_default=True)
        default_address = delivery_address_qs.first()
        if not default_address: # Fallback to any address if no default is set
            default_address = DeliveryAddress.objects.filter(user_profile=request_user_profile).first()

        if default_address:
            validated_data['delivery_address_snapshot'] = f"{default_address.address_line1}, {default_address.address_line2 or ''}, {default_address.city}, {default_address.prefecture} {default_address.postal_code}"
        else:
            # If no address on file, client should provide it, or order placement should fail.
            # For now, let's make it optional or require it in validated_data.
            if 'delivery_address_snapshot' not in validated_data:
                 validated_data['delivery_address_snapshot'] = "No address provided"


        validated_data['order_status'] = Order.ORDER_STATUS_CHOICES[0][0] # 'pending_confirmation'

        # Create the Order instance (without items and total price yet)
        order = Order(**validated_data)
        # We will save it after items are processed and total price is calculated

        calculated_total_order_price = 0
        order_items_to_create = []

        for item_data in ordered_items_data:
            product_instance = item_data['product']
            quantity = item_data['quantity_kg']

            if product_instance.producer_profile != producer_profile_instance:
                raise serializers.ValidationError({"ordered_items": "All items in an order must be from the same producer."})

            if not product_instance.available:
                raise serializers.ValidationError({"ordered_items": f"Product '{product_instance.name}' is not available."})

            if quantity <= 0:
                raise serializers.ValidationError({"ordered_items": "Quantity must be positive."})


            # Defer stock check until producer confirmation, or do it here if policy is to reserve stock on order placement
            # For now, let's assume stock is checked/deducted upon producer confirmation.

            item_total_price = quantity * product_instance.price_yen_per_kg

            order_items_to_create.append(OrderItem(
                order=order, # Temporary assignment, will be saved later
                product=product_instance,
                quantity_kg=quantity,
                price_yen_per_kg_snapshot=product_instance.price_yen_per_kg,
                product_name_snapshot=product_instance.name,
                total_price_yen=item_total_price
            ))
            calculated_total_order_price += item_total_price

        order.total_price_yen = calculated_total_order_price

        # Now save the order and then its items
        # This is not fully atomic here, ideally use transaction.atomic in the view
        order.save() # Save order to get an ID
        for item_to_create in order_items_to_create:
            item_to_create.order = order # Assign the now-saved order
            item_to_create.save()

        return order
