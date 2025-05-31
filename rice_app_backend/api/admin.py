from django.contrib import admin
from .models import UserProfile, ProducerProfile, Product, DeliveryAddress, Order, OrderItem

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'phone_number', 'created_at')
    list_filter = ('role',)
    search_fields = ('user__username', 'phone_number')

@admin.register(ProducerProfile)
class ProducerProfileAdmin(admin.ModelAdmin):
    list_display = ('user_profile_username', 'business_name', 'delivery_radius_km', 'address_latitude', 'address_longitude')
    search_fields = ('user_profile__user__username', 'business_name')
    raw_id_fields = ('user_profile',) # For easier selection

    def user_profile_username(self, obj):
        return obj.user_profile.user.username
    user_profile_username.short_description = 'Username'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'producer_profile_username', 'rice_type', 'quantity_kg', 'price_yen_per_kg', 'available', 'updated_at')
    list_filter = ('rice_type', 'available', 'producer_profile__user_profile__user__username')
    search_fields = ('name', 'description', 'producer_profile__user_profile__user__username')
    list_editable = ('available', 'quantity_kg', 'price_yen_per_kg')
    raw_id_fields = ('producer_profile',)

    def producer_profile_username(self, obj):
        return obj.producer_profile.user_profile.user.username
    producer_profile_username.short_description = 'Producer'

@admin.register(DeliveryAddress)
class DeliveryAddressAdmin(admin.ModelAdmin):
    list_display = ('user_profile_username', 'address_line1', 'city', 'prefecture', 'postal_code', 'is_default')
    list_filter = ('prefecture', 'city', 'is_default')
    search_fields = ('user_profile__user__username', 'address_line1', 'postal_code')
    raw_id_fields = ('user_profile',)

    def user_profile_username(self, obj):
        return obj.user_profile.user.username
    user_profile_username.short_description = 'User'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'consumer_username', 'producer_username', 'order_status', 'total_price_yen', 'created_at')
    list_filter = ('order_status', 'created_at', 'producer_profile__user_profile__user__username')
    search_fields = ('consumer_profile__user__username', 'producer_profile__user_profile__user__username', 'id')
    date_hierarchy = 'created_at'
    raw_id_fields = ('consumer_profile', 'producer_profile')

    def consumer_username(self, obj):
        return obj.consumer_profile.user.username if obj.consumer_profile else None
    consumer_username.short_description = 'Consumer'

    def producer_username(self, obj):
        return obj.producer_profile.user_profile.user.username if obj.producer_profile else None
    producer_username.short_description = 'Producer'


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    raw_id_fields = ('product',)
    extra = 0 # Don't show extra forms by default
    # Add fields to display in the inline form, potentially read-only for snapshots
    readonly_fields = ('product_name_snapshot', 'price_yen_per_kg_snapshot', 'total_price_yen')
    # Fields that can be edited when creating/modifying order
    fields = ('product', 'quantity_kg', 'price_yen_per_kg_snapshot', 'product_name_snapshot', 'total_price_yen')


# Re-register Order with OrderItemInline if you want OrderItems editable directly within Order admin page
admin.site.unregister(Order) # Unregister the simple OrderAdmin first
@admin.register(Order)
class OrderAdminWithItems(OrderAdmin): # Inherit from the previous OrderAdmin
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order_id_link', 'product_name_snapshot', 'quantity_kg', 'price_yen_per_kg_snapshot', 'total_price_yen')
    search_fields = ('order__id', 'product_name_snapshot')
    raw_id_fields = ('order', 'product')
    readonly_fields = ('total_price_yen',) # Calculated field

    def order_id_link(self, obj):
        from django.urls import reverse
        from django.utils.html import format_html
        link = reverse("admin:api_order_change", args=[obj.order.id])
        return format_html('<a href="{}">{}</a>', link, obj.order.id)
    order_id_link.short_description = 'Order ID'
