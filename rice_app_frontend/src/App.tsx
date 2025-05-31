import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Producer Pages
import ProducerDashboardPage from './pages/ProducerDashboardPage';
import ProductCreatePage from './pages/ProductCreatePage';
import ProductEditPage from './pages/ProductEditPage';
import ProducerProfilePage from './pages/ProducerProfilePage';

// Placeholder for Home page
const HomePage: React.FC = () => {
    const { isAuthenticated, userToken } = useAuth();
    // TODO: Decode token or fetch user profile to get role
    // const userRole = getUserRoleFromToken(userToken);
    // For now, just basic links
    return (
        <div>
            <h1>Welcome to the Rice Direct App!</h1>
            {isAuthenticated && <p>You are logged in.</p>}
            {/* {isAuthenticated && userRole === 'producer' && <Link to="/producer/dashboard">Producer Dashboard</Link>}
            {isAuthenticated && userRole === 'consumer' && <Link to="/consumer/dashboard">Browse Products</Link>} */}
        </div>
    );
}

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: string[]; // e.g., ['producer', 'consumer']
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, userToken } = useAuth();
  // const userRole = useAuth().userRole; // Assuming userRole is part of AuthContext state

  if (isLoading) return <p>Loading authentication status...</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // TODO: Implement role checking if allowedRoles is provided
  // For now, if authenticated, allow access. Role check should be added to useAuth/AuthContext
  // For example:
  // if (allowedRoles && !allowedRoles.includes(userRole)) {
  //   return <Navigate to="/unauthorized" replace />;
  // }

  return children;
};


// Basic Layout component
const Layout: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  // const userRole = useAuth().userRole; // Placeholder

  return (
    <div>
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>
          {!isAuthenticated && <li><Link to="/register">Register</Link></li>}
          {!isAuthenticated && <li><Link to="/login">Login</Link></li>}
          {isAuthenticated && (
            <>
              {/* Example: Conditionally show dashboard links based on role */}
              {/* {userRole === 'producer' && <li><Link to="/producer/dashboard">Producer Dashboard</Link></li>}
              {userRole === 'consumer' && <li><Link to="/consumer/dashboard">Browse</Link></li>} */}
              {/* For now, show generic dashboard link if role check not implemented */}
              <li><Link to="/producer/dashboard">Producer Dashboard (Temp)</Link></li>
              <li><button onClick={logout}>Logout</button></li>
            </>
          )}
        </ul>
      </nav>
      <hr />
      <Outlet /> {/* Child routes will render here */}
    </div>
  );
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}> {/* All routes use the Layout */}
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Producer Routes - Protected */}
            <Route path="/producer/dashboard" element={<ProtectedRoute><ProducerDashboardPage /></ProtectedRoute>} />
            <Route path="/producer/profile" element={<ProtectedRoute><ProducerProfilePage /></ProtectedRoute>} />
            <Route path="/producer/products/new" element={<ProtectedRoute><ProductCreatePage /></ProtectedRoute>} />
            <Route path="/producer/products/edit/:productId" element={<ProtectedRoute><ProductEditPage /></ProtectedRoute>} />
            {/* Add other producer-specific routes here, e.g., for orders */}

            {/* TODO: Add Consumer specific routes */}
            {/* TODO: Add a 404 Not Found page */}
            {/* TODO: Add an Unauthorized page */}
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
