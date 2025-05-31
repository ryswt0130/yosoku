import React, { useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationItem from '../components/Notifications/NotificationItem';

const NotificationsPage: React.FC = () => {
  const { notifications, fetchNotifications, isLoading, error, markAllAsRead, unreadCount } = useNotifications();

  useEffect(() => {
    // Fetch notifications when component mounts, if not already loaded recently
    // NotificationContext already polls, so this might be redundant or for explicit refresh
    // fetchNotifications();
  }, [fetchNotifications]);

  if (isLoading && notifications.length === 0) return <p>Loading notifications...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h1>All Notifications</h1>
      {unreadCount > 0 && <button onClick={markAllAsRead} style={{marginBottom: '20px'}}>Mark all as read</button>}
      {notifications.length === 0 && <p>You have no notifications.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {notifications.map(notif => (
          <NotificationItem key={notif.id} notification={notif} />
        ))}
      </ul>
    </div>
  );
};

export default NotificationsPage;
