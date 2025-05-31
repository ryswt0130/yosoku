import React from 'react';
import { Link } from 'react-router-dom';
import { ProductData } from '../../interfaces';

interface ProductCardProps {
  product: ProductData;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div style={{ border: '1px solid #ccc', margin: '10px', padding: '10px', width: '200px' }}>
      {product.image && <img src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)} alt={product.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />}
      <h3>{product.name}</h3>
      <p>By: {product.producer_profile_username || 'N/A'}</p>
      <p>Type: {product.rice_type}</p>
      <p>Price: ¥{product.price_yen_per_kg}/kg</p>
      <Link to={`/products/${product.id}`}>View Details</Link>
      {/* TODO: Add to cart button */}
    </div>
  );
};

export default ProductCard;
