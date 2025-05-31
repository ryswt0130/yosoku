import React from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationItem from './NotificationItem';
import { Link } from 'react-router-dom';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void; // To close dropdown when navigating or clicking outside
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAllAsRead, isLoading, error } = useNotifications();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50px', // Adjust based on navbar height
      right: '10px',
      width: '300px',
      maxHeight: '400px',
      overflowY: 'auto',
      backgroundColor: 'white',
      border: '1px solid #ccc',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      zIndex: 1000,
    }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Notifications</strong>
        {unreadCount > 0 && <button onClick={() => { markAllAsRead(); /* onClose(); */ }}>Mark all as read</button>}
      </div>
      {isLoading && <p style={{padding: '10px'}}>Loading...</p>}
      {error && <p style={{padding: '10px', color: 'red'}}>Error: {error}</p>}
      {!isLoading && !error && notifications.length === 0 && <p style={{padding: '10px'}}>No notifications.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {notifications.slice(0, 10).map(notif => ( // Show recent 10
          <NotificationItem key={notif.id} notification={notif} />
        ))}
      </ul>
      {notifications.length > 5 && (
        <div style={{ padding: '10px', textAlign: 'center', borderTop: '1px solid #eee' }}>
          <Link to="/notifications" onClick={onClose}>View all notifications</Link>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
