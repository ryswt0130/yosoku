import React, { useEffect, useState } from 'react';
import OrderHistoryList from '../components/Consumer/OrderHistoryList';
import consumerService from '../services/consumerService';
import { OrderData } from '../interfaces';

const OrderHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    consumerService.getMyOrderHistory()
      .then(data => { setOrders(data); setError(null); })
      .catch(err => setError(err.message || 'Failed to fetch order history'))
      .finally(() => setLoading(false));
  }
  useEffect(fetchOrders, []);

  const handleCancelOrder = async (orderId: number) => {
    if(window.confirm("Are you sure you want to cancel this order?")) {
        try {
            await consumerService.cancelMyOrder(orderId);
            fetchOrders(); // Refresh orders
        } catch (err: any) {
            alert("Failed to cancel order: " + (err.response?.data?.detail || err.message));
        }
    }
  }

  if (loading) return <p>Loading order history...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h2>My Order History</h2>
      <OrderHistoryList orders={orders} onCancelOrder={handleCancelOrder} />
    </div>
  );
};
export default OrderHistoryPage;
