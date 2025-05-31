import React, { useEffect, useState } from 'react';
import ProductCard from '../components/Consumer/ProductCard';
import productService from '../services/productService';
import { ProductData } from '../interfaces';
// TODO: Add search/filter component

const ProductBrowsePage: React.FC = () => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // TODO: Add state for search terms and filters

  useEffect(() => {
    setLoading(true);
    productService.getPublicProducts() // TODO: Pass search/filter params
      .then(data => { setProducts(data); setError(null); })
      .catch(err => setError(err.message || 'Failed to fetch products'))
      .finally(() => setLoading(false));
  }, []); // TODO: Add dependencies for search/filter

  if (loading) return <p>Loading products...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h1>Browse Rice Products</h1>
      {/* TODO: <ProductSearchFilter onSearch={handleSearch} /> */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {products.length > 0 ? products.map(p => <ProductCard key={p.id} product={p} />) : <p>No products found.</p>}
      </div>
    </div>
  );
};
export default ProductBrowsePage;
