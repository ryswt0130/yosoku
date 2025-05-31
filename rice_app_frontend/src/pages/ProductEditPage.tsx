import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProductForm from '../components/Producer/ProductForm';
import productService from '../services/productService';
import { ProductData } from '../interfaces';

const ProductEditPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);


  useEffect(() => {
    if (productId) {
      setIsLoading(true);
      productService.getProductById(Number(productId))
        .then(data => {
          setProduct(data);
          setFetchError(null);
        })
        .catch(err => {
          setFetchError(err.message || 'Failed to fetch product details');
        })
        .finally(() => setIsLoading(false));
    }
  }, [productId]);

  const handleSave = async (formData: FormData, id?: number) => {
    if (!id) return;
    setIsLoading(true);
    setSaveError(null);
    try {
      await productService.updateProduct(id, formData);
      navigate('/producer/dashboard'); // Or back to product list
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to update product');
      setIsLoading(false);
    }
  };

  if (isLoading && !product) return <p>Loading product details...</p>; // Show loading only if product not yet fetched
  if (fetchError) return <p style={{ color: 'red' }}>Error: {fetchError}</p>;
  if (!product) return <p>Product not found.</p>;

  return (
    <div>
      <h2>Edit Product: {product.name}</h2>
      <ProductForm product={product} onSave={handleSave} isLoading={isLoading} error={saveError} />
    </div>
  );
};

export default ProductEditPage;
