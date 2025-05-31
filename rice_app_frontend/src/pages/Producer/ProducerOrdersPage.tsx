import React, { useEffect, useState, useCallback } from 'react';
import ProducerOrderList from '../../components/Producer/OrderManagement/ProducerOrderList';
import producerService from '../../services/producerService';
import { OrderData } from '../../interfaces';
import { useAuth } from '../../hooks/useAuth';

const ProducerOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userToken } = useAuth();

  const fetchProducerOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await producerService.getProducerOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userToken) {
      fetchProducerOrders();
    }
  }, [userToken, fetchProducerOrders]);

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      await producerService.updateOrderStatusAsProducer(orderId, newStatus);
      fetchProducerOrders();
    } catch (err: any) {
      alert(`Failed to update order status: ${err.response?.data?.error || err.message}`);
    }
  };

  if (loading) return <p>Loading orders...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h1>Manage Your Orders</h1>
      <ProducerOrderList orders={orders} onUpdateStatus={handleUpdateStatus} />
    </div>
  );
};

export default ProducerOrdersPage;
