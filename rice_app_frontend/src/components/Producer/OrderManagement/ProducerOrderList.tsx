import React from 'react';
import { Link } from 'react-router-dom';
import { OrderData } from '../../../interfaces';

interface ProducerOrderListProps {
  orders: OrderData[];
  onUpdateStatus: (orderId: number, newStatus: string) => void;
}

const PRODUCER_ORDER_ACTIONS: { [key: string]: string[] } = {
  pending_confirmation: ['confirmed_by_producer', 'cancelled_by_producer'],
  confirmed_by_producer: ['out_for_delivery', 'cancelled_by_producer'],
  awaiting_payment: [],
  paid: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  completed: [],
  cancelled_by_consumer: [],
  cancelled_by_producer: [],
};


const ProducerOrderList: React.FC<ProducerOrderListProps> = ({ orders, onUpdateStatus }) => {
  if (!orders || orders.length === 0) {
    return <p>No orders received yet.</p>;
  }

  return (
    <div>
      <h3>Received Orders</h3>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Date</th>
            <th>Consumer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td><Link to={`/producer/orders/${order.id}`}>{order.id}</Link></td>
              <td>{new Date(order.created_at || '').toLocaleDateString()}</td>
              <td>{order.consumer_username || 'N/A'}</td>
              <td>¥{order.total_price_yen}</td>
              <td>{order.order_status}</td>
              <td>
                {PRODUCER_ORDER_ACTIONS[order.order_status]?.map(actionStatus => (
                  <button
                    key={actionStatus}
                    onClick={() => order.id && onUpdateStatus(order.id, actionStatus)}
                    style={{marginRight: '5px'}}
                  >
                    {actionStatus.replace(/_/g, ' ').replace('producer', '').replace('by', '').trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ')}
                  </button>
                ))}
                <Link to={`/producer/orders/${order.id}`} style={{marginLeft: '10px'}}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProducerOrderList;
