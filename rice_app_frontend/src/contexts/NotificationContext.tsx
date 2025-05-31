import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode } from 'react';
import notificationService from '../services/notificationService';
import { NotificationData } from '../interfaces';
import { useAuth } from '../hooks/useAuth'; // To fetch only if authenticated

interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (ids: number[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markOneAsRead: (id: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth(); // Get auth state

  const calculateUnread = (notifs: NotificationData[]) => {
    return notifs.filter(n => !n.is_read).length;
  };

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
        setNotifications([]);
        setUnreadCount(0);
        return; // Don't fetch if not logged in
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await notificationService.getMyNotifications();
      setNotifications(data);
      setUnreadCount(calculateUnread(data));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
      setNotifications([]); // Clear on error
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]); // Re-fetch if auth state changes

  useEffect(() => {
    fetchNotifications();
    // Simple polling every 60 seconds if authenticated
    const intervalId = setInterval(() => {
        if (isAuthenticated) {
            fetchNotifications();
        }
    }, 60000);
    return () => clearInterval(intervalId);
  }, [fetchNotifications, isAuthenticated]);


  const markAsRead = async (ids: number[]) => {
    try {
      await notificationService.markNotificationsAsRead(ids);
      // Optimistic update or re-fetch
      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => prev - ids.length); // Adjust count, ensure it's not negative
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
      // Optionally re-fetch to get authoritative state: fetchNotifications();
    }
  };

  const markOneAsRead = async (id: number) => {
    const notification = notifications.find(n => n.id === id);
    if (notification && !notification.is_read) {
        try {
            await notificationService.markSingleNotificationAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Failed to mark notification as read", err);
        }
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, markOneAsRead, isLoading, error }}>
      {children}
    </NotificationContext.Provider>
  );
};
