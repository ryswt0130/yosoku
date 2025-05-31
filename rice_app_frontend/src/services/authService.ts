import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api/v1/auth/'; // Base URL for auth

interface AuthResponse {
  token: string;
  // Add other user details if login returns them
}

interface UserRegistrationData {
  username?: string;
  email?: string;
  password?: string;
  profile?: {
    role: 'producer' | 'consumer';
    phone_number?: string;
  };
}

const register = async (userData: UserRegistrationData) => {
  return axios.post<UserRegistrationData & { id: number }>(API_URL + 'register/', userData);
};

const login = async (username?: string, password?: string) => {
  return axios.post<AuthResponse>(API_URL + 'login/', { username, password });
};

const logout = () => {
  localStorage.removeItem('userToken');
  // Potentially also remove user info from state/context
};

const getCurrentUserToken = () => {
  return localStorage.getItem('userToken');
};

const authService = {
  register,
  login,
  logout,
  getCurrentUserToken,
};

export default authService;
