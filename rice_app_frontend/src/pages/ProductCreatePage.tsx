import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductForm from '../components/Producer/ProductForm';
import productService from '../services/productService';

const ProductCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await productService.createProduct(formData);
      navigate('/producer/dashboard'); // Or to product list within dashboard
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create product');
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Add New Product</h2>
      <ProductForm onSave={handleSave} isLoading={isLoading} error={error} />
    </div>
  );
};

export default ProductCreatePage;
