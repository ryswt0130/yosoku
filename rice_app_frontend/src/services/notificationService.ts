import apiClient from './apiClient';
import { NotificationData } from '../interfaces';

const BASE_URL = '/notifications'; // Relative to apiClient's baseURL (/api/v1)

const getMyNotifications = async (): Promise<NotificationData[]> => {
  const response = await apiClient.get<NotificationData[]>(BASE_URL + '/');
  return response.data;
};

// Mark specific notifications as read
const markNotificationsAsRead = async (notificationIds: number[]): Promise<any> => {
  const response = await apiClient.post(`${BASE_URL}/mark-as-read/`, { ids: notificationIds });
  return response.data;
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (): Promise<any> => {
  const response = await apiClient.post(`${BASE_URL}/mark-as-read/`, { ids: [] }); // Empty array means all for backend
  return response.data;
};

// Mark a single notification as read (using PATCH to detail view)
const markSingleNotificationAsRead = async (notificationId: number): Promise<NotificationData> => {
    const response = await apiClient.patch<NotificationData>(`${BASE_URL}/${notificationId}/`, { is_read: true });
    return response.data;
};


const notificationService = {
  getMyNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  markSingleNotificationAsRead,
};

export default notificationService;
