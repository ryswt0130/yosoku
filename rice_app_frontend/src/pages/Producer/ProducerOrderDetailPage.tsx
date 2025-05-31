import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import producerService from '../../services/producerService';
import { OrderData, OrderItemData } from '../../interfaces';

const ProducerOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      producerService.getProducerOrderDetail(Number(orderId))
        .then(data => {
          setOrder(data);
          setError(null);
        })
        .catch(err => {
          setError(err.message || 'Failed to fetch order details');
        })
        .finally(() => setLoading(false));
    }
  }, [orderId]);

  if (loading) return <p>Loading order details...</p>;
  if (error) return <p style={{ color: 'red' }}>Error fetching order: {error}</p>;
  if (!order) return <p>Order not found.</p>;

  return (
    <div>
      <h2>Order Details (ID: {order.id}) - Producer View</h2>
      <p><strong>Status:</strong> {order.order_status}</p>
      <p><strong>Date Placed:</strong> {new Date(order.created_at || '').toLocaleString()}</p>
      <p><strong>Consumer:</strong> {order.consumer_username || 'N/A'}</p>
      <p><strong>Total Amount:</strong> ¥{order.total_price_yen}</p>
      <p><strong>Delivery Address:</strong> {order.delivery_address_snapshot}</p>
      {order.notes_by_consumer && <p><strong>Consumer Notes:</strong> {order.notes_by_consumer}</p>}

      <h3>Items in this Order:</h3>
      {order.items && order.items.length > 0 ? (
        <ul>
          {order.items.map((item: OrderItemData) => (
            <li key={item.id}>
              {item.product_name_snapshot} ({item.quantity_kg} kg) - ¥{item.price_yen_per_kg_snapshot}/kg = ¥{item.total_price_yen}
            </li>
          ))}
        </ul>
      ) : <p>No items found in this order.</p>}

      <Link to="/producer/orders">Back to Orders List</Link>
    </div>
  );
};

export default ProducerOrderDetailPage;
