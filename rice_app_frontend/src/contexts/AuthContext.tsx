import React, { createContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/authService';
// You might want to decode the token to get user info or fetch user profile separately
// For simplicity, we'll just store the token and a boolean isAuthenticated.

interface AuthContextType {
  isAuthenticated: boolean;
  userToken: string | null;
  isLoading: boolean;
  login: (username?: string, password?: string) => Promise<void>;
  logout: () => void;
  register: (userData: any) => Promise<any>; // Define userData type more specifically
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem('userToken'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (token) {
      setUserToken(token);
      // TODO: Validate token with backend or decode to get user info / expiry
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (username?: string, password?: string) => {
    try {
      const response = await authService.login(username, password);
      localStorage.setItem('userToken', response.data.token);
      setUserToken(response.data.token);
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Re-throw to allow components to handle it
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUserToken(null);
    // TODO: Redirect to login page or home
  };

  const handleRegister = async (userData: any) => {
    try {
      const response = await authService.register(userData);
      // Optionally log the user in directly after registration
      // For now, just return the response. User can then log in.
      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };


  return (
    <AuthContext.Provider value={{ isAuthenticated: !!userToken, userToken, isLoading, login: handleLogin, logout: handleLogout, register: handleRegister }}>
      {children}
    </AuthContext.Provider>
  );
};
