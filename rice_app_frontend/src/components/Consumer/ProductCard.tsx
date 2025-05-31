import React from 'react';
import { Link } from 'react-router-dom';
import { ProductData } from '../../interfaces';

interface ProductCardProps {
  product: ProductData;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  // Inline styles removed, relying on .product-card from index.css
  return (
    <div className="product-card">
      {product.image && <img src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)} alt={product.name} />}
      <h3>{product.name}</h3>
      <p>By: {product.producer_profile_username || 'N/A'}</p>
      <p>Type: {product.rice_type}</p>
      <p>Price: ¥{product.price_yen_per_kg}/kg</p>
      <Link to={`/products/${product.id}`}>View Details</Link>
    </div>
  );
};

export default ProductCard;
