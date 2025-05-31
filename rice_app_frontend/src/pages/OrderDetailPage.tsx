import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import consumerService from '../services/consumerService';
import { OrderData, OrderItemData } from '../interfaces'; // Assuming OrderItemData is part of interfaces

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      consumerService.getOrderDetails(Number(orderId))
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
      <h2>Order Details (ID: {order.id})</h2>
      <p><strong>Status:</strong> {order.order_status}</p>
      <p><strong>Date Placed:</strong> {new Date(order.created_at || '').toLocaleString()}</p>
      <p><strong>Total Amount:</strong> ¥{order.total_price_yen}</p>
      <p><strong>Producer:</strong> {order.producer_username || 'N/A'}</p>
      <p><strong>Delivery Address:</strong> {order.delivery_address_snapshot}</p>
      {order.notes_by_consumer && <p><strong>Your Notes:</strong> {order.notes_by_consumer}</p>}
      {order.notes_by_producer && <p><strong>Producer Notes:</strong> {order.notes_by_producer}</p>}

      <h3>Items in this Order:</h3>
      {order.items && order.items.length > 0 ? (
        <ul>
          {order.items.map((item: OrderItemData) => ( // Explicitly type item here
            <li key={item.id}>
              {item.product ? <Link to={`/products/${item.product.id}`}>{item.product_name_snapshot}</Link> : item.product_name_snapshot}
              ({item.quantity_kg} kg) - ¥{item.price_yen_per_kg_snapshot}/kg = ¥{item.total_price_yen}
            </li>
          ))}
        </ul>
      ) : <p>No items found in this order.</p>}
      <Link to="/consumer/orders">Back to Order History</Link>
    </div>
  );
};

export default OrderDetailPage;
