import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom'; // Outlet for nested routes
import ProductList from '../components/Producer/ProductList';
import productService from '../services/productService';
import { ProductData } from '../interfaces';
import { useAuth } from '../hooks/useAuth'; // To check if user is producer

const ProducerDashboardPage: React.FC = () => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userToken } = useAuth(); // Example: useAuth could provide user role

  // TODO: Add check to ensure only producers can access this page.
  // This should be handled by ProtectedRoute in App.tsx with role checking.

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await productService.getMyProducts();
      setProducts(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(userToken) { // Ensure user is logged in before fetching
        fetchProducts();
    }
  }, [userToken]);

  const handleDeleteProduct = async (productId: number) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productService.deleteProduct(productId);
        setProducts(prev => prev.filter(p => p.id !== productId)); // Optimistic update
      } catch (err: any) {
        setError(err.message || 'Failed to delete product');
        // Optionally re-fetch products or handle error more gracefully
      }
    }
  };

  if (loading) return <p>Loading products...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h1>Producer Dashboard</h1>
      <nav>
        <Link to="/producer/profile">My Profile</Link> |
        <Link to="/producer/products">My Products</Link> |
        <Link to="/producer/orders">My Orders</Link> {/* Placeholder */}
      </nav>
      <hr/>
      {/* Outlet will render child routes like product list, forms, etc. */}
      {/* For now, ProductList is directly here, but could be a child route */}
      <ProductList products={products} onDelete={handleDeleteProduct} />
      {/* <Outlet /> */} {/* If using nested routes for product list/forms */}
    </div>
  );
};

export default ProducerDashboardPage;
