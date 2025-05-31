export interface ProducerProfileData {
  id?: number;
  user_profile?: number; // ID of the UserProfile
  user_profile_username?: string;
  email?: string;
  business_name?: string;
  address_latitude?: number | string; // String for form input
  address_longitude?: number | string; // String for form input
  delivery_radius_km?: number | string; // String for form input
  bio?: string;
}

export interface ProductData {
  id?: number;
  producer_profile?: number; // ID of the ProducerProfile
  producer_profile_username?: string;
  name: string;
  description?: string;
  rice_type: string; // Consider a select field with choices from backend Product model
  quantity_kg: number | string; // String for form input
  price_yen_per_kg: number | string; // String for form input
  image?: File | null | string; // File for upload, string for existing image URL
  available?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Add other interfaces as needed, e.g., for OrderData specifically for producer view

// Consumer specific interfaces
export interface DeliveryAddressData {
  id?: number;
  user_profile?: number; // ID of the UserProfile
  address_line1: string;
  address_line2?: string;
  city: string;
  prefecture: string;
  postal_code: string;
  country?: string;
  is_default?: boolean;
}

export interface OrderItemData { // For displaying in order history
  id?: number;
  product?: ProductData; // Expanded product data
  product_name_snapshot: string;
  quantity_kg: number | string;
  price_yen_per_kg_snapshot: number | string;
  total_price_yen: number | string;
}

export interface OrderData { // For consumer order history
  id?: number;
  consumer_profile?: number;
  consumer_username?: string;
  producer_profile?: number;
  producer_username?: string;
  delivery_address_snapshot: string;
  total_price_yen: number | string;
  order_status: string;
  notes_by_consumer?: string;
  notes_by_producer?: string;
  items: OrderItemData[]; // Read-only items
  created_at?: string;
  updated_at?: string;
}

// For placing an order (simplified)
export interface PlaceOrderPayload {
    ordered_items: Array<{ product_id: number; quantity_kg: number }>;
    delivery_address_snapshot: string; // Or send address ID and let backend fetch/format
    notes_by_consumer?: string;
    // producer_profile_id will be derived by backend from product_id
}


export interface NotificationData {
  id: number;
  recipient_username?: string; // From serializer
  message: string;
  is_read: boolean;
  notification_type: string;
  related_object_url?: string | null;
  created_at: string;
  updated_at?: string;
}
