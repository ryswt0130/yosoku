import apiClient from './apiClient';
import { DeliveryAddressData, OrderData, PlaceOrderPayload } from '../interfaces';

const ADDRESS_URL = '/addresses'; // from api/urls.py: router.register(r'addresses', ...)
const ORDER_URL = '/orders';    // from api/urls.py: router.register(r'orders', ...)

// Delivery Addresses
const getMyAddresses = async (): Promise<DeliveryAddressData[]> => {
  const response = await apiClient.get<DeliveryAddressData[]>(ADDRESS_URL + '/');
  return response.data;
};

const createAddress = async (addressData: DeliveryAddressData): Promise<DeliveryAddressData> => {
  const response = await apiClient.post<DeliveryAddressData>(ADDRESS_URL + '/', addressData);
  return response.data;
};

const updateAddress = async (addressId: number, addressData: DeliveryAddressData): Promise<DeliveryAddressData> => {
  const response = await apiClient.put<DeliveryAddressData>(`${ADDRESS_URL}/${addressId}/`, addressData);
  return response.data;
};

const deleteAddress = async (addressId: number): Promise<void> => {
  await apiClient.delete(`${ADDRESS_URL}/${addressId}/`);
};

// Orders
const getMyOrderHistory = async (): Promise<OrderData[]> => {
  const response = await apiClient.get<OrderData[]>(ORDER_URL + '/'); // Assumes backend filters by current user
  return response.data;
};

const getOrderDetails = async (orderId: number): Promise<OrderData> => {
    const response = await apiClient.get<OrderData>(`${ORDER_URL}/${orderId}/`);
    return response.data;
};

const placeOrder = async (orderPayload: PlaceOrderPayload): Promise<OrderData> => {
    const response = await apiClient.post<OrderData>(ORDER_URL + '/', orderPayload);
    return response.data;
};

// Consumer can cancel an order if it's in 'pending_confirmation' status
const cancelMyOrder = async (orderId: number): Promise<OrderData> => {
    const response = await apiClient.patch<OrderData>(`${ORDER_URL}/${orderId}/update_status/`, {
        order_status: 'cancelled_by_consumer'
    });
    return response.data;
};


const consumerService = {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getMyOrderHistory,
  getOrderDetails,
  placeOrder,
  cancelMyOrder,
};

export default consumerService;
