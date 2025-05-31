import axios from 'axios';
import authService from './authService';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1', // Ensure this is the root API URL
});

apiClient.interceptors.request.use(
  (config) => {
    const token = authService.getCurrentUserToken();
    if (token) {
      config.headers['Authorization'] = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
