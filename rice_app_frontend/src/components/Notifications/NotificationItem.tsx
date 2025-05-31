import React from 'react';
import { Link } from 'react-router-dom';
import { NotificationData } from '../../interfaces';
import { useNotifications } from '../../contexts/NotificationContext'; // To mark as read

interface NotificationItemProps {
  notification: NotificationData;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const { markOneAsRead } = useNotifications();

  const handleNotificationClick = () => {
    if (!notification.is_read) {
      markOneAsRead(notification.id);
    }
    // Navigation will be handled by Link if related_object_url exists
  };

  const content = (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #eee', background: notification.is_read ? 'transparent' : '#f0f8ff' }}>
      <p style={{ margin: 0, fontSize: '0.9em' }}>{notification.message}</p>
      <small style={{ color: '#777' }}>{new Date(notification.created_at).toLocaleString()}</small>
    </div>
  );

  return (
    <li onClick={handleNotificationClick} style={{listStyleType: 'none', cursor: 'pointer'}}>
      {notification.related_object_url ? (
        <Link to={notification.related_object_url} style={{ textDecoration: 'none', color: 'inherit' }}>
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
};

export default NotificationItem;
