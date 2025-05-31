import React from 'react';
import { Link } from 'react-router-dom';
import { OrderData } from '../../interfaces';

interface OrderHistoryListProps {
  orders: OrderData[];
  onCancelOrder?: (orderId: number) => void;
}

const OrderHistoryList: React.FC<OrderHistoryListProps> = ({ orders, onCancelOrder }) => {
  if (orders.length === 0) return <p>You have no past orders.</p>;
  return (
    <ul>
      {orders.map(order => (
        <li key={order.id}>
          <p>Order ID: <Link to={`/orders/${order.id}`}>{order.id}</Link></p>
          <p>Date: {new Date(order.created_at || '').toLocaleDateString()}</p>
          <p>Total: ¥{order.total_price_yen}</p>
          <p>Status: {order.order_status}</p>
          <p>Producer: {order.producer_username || 'N/A'}</p>
          {order.order_status === 'pending_confirmation' && onCancelOrder && order.id && (
            <button onClick={() => onCancelOrder(order.id!)}>Cancel Order</button>
          )}
        </li>
      ))}
    </ul>
  );
};
export default OrderHistoryList;
