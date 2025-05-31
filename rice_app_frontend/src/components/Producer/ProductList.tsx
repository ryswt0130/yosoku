import React from 'react';
import { Link } from 'react-router-dom';
import { ProductData } from '../../interfaces';

interface ProductListProps {
  products: ProductData[];
  onDelete: (productId: number) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onDelete }) => {
  if (products.length === 0) {
    return <p>You haven't added any products yet. <Link to="/producer/products/new">Add one now!</Link></p>;
  }

  return (
    <div>
      <h2>My Products</h2>
      <Link to="/producer/products/new">Add New Product</Link>
      <ul>
        {products.map(product => (
          <li key={product.id}>
            <h3>{product.name}</h3>
            <p>Type: {product.rice_type}</p>
            <p>Quantity: {product.quantity_kg} kg</p>
            <p>Price: ¥{product.price_yen_per_kg} per kg</p>
            <p>Status: {product.available ? 'Available' : 'Not Available'}</p>
            {product.image && typeof product.image === 'string' && <img src={product.image} alt={product.name} style={{width: "100px", height: "auto"}} />}
            <Link to={`/producer/products/edit/${product.id}`}>Edit</Link>
            <button onClick={() => product.id && onDelete(product.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductList;
