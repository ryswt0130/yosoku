import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import productService from '../services/productService';
import consumerService from '../services/consumerService';
import { ProductData, DeliveryAddressData, PlaceOrderPayload } from '../interfaces';
import { useAuth } from '../hooks/useAuth';


const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [addresses, setAddresses] = useState<DeliveryAddressData[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (productId) {
      setLoading(true);
      productService.getProductById(Number(productId))
        .then(data => { setProduct(data); setError(null); })
        .catch(err => setError(err.message || 'Failed to fetch product details'))
        .finally(() => setLoading(false));

      if (isAuthenticated) {
        consumerService.getMyAddresses()
          .then(data => {
            setAddresses(data);
            const defaultAddr = data.find(a => a.is_default);
            if (defaultAddr && defaultAddr.id) setSelectedAddressId(String(defaultAddr.id));
            else if (data.length > 0 && data[0].id) setSelectedAddressId(String(data[0].id));
          })
          .catch(err => console.error("Failed to fetch addresses", err));
      }
    }
  }, [productId, isAuthenticated]);

  const handlePlaceOrder = async () => {
    if (!product || !product.id || !isAuthenticated) {
        setOrderError("Product not loaded or user not authenticated.");
        return;
    }
    if (!selectedAddressId && addresses.length > 0) {
        setOrderError("Please select a delivery address.");
        return;
    }
    if (addresses.length === 0 && !selectedAddressId) { // No addresses on file
        // For simplicity, we'll use a placeholder. A real app would prompt for address.
        // Or navigate to address management page.
        setOrderError("No delivery address found. Please add one in your profile.");
        navigate('/consumer/addresses'); // Redirect to manage addresses
        return;
    }


    const selectedAddrObj = addresses.find(a => String(a.id) === selectedAddressId);
    let deliverySnapshot = "No address selected";
    if (selectedAddrObj) {
        deliverySnapshot = `${selectedAddrObj.address_line1}, ${selectedAddrObj.address_line2 || ''}, ${selectedAddrObj.city}, ${selectedAddrObj.prefecture} ${selectedAddrObj.postal_code}`;
    } else if (addresses.length === 0) {
        // This case should ideally be handled by redirecting to add address
         deliverySnapshot = "Error: Address not found after selection prompt.";
    }


    const payload: PlaceOrderPayload = {
        ordered_items: [{ product_id: product.id, quantity_kg: Number(quantity) }],
        delivery_address_snapshot: deliverySnapshot,
        // notes_by_consumer: "Please deliver in the evening." // Example note
    };
    setOrderError(null);
    try {
        await consumerService.placeOrder(payload);
        alert('Order placed successfully!');
        navigate('/consumer/orders'); // Navigate to order history
    } catch (err: any) {
        setOrderError(err.response?.data?.detail || err.response?.data?.ordered_items || err.message || 'Failed to place order');
    }
  };


  if (loading) return <p>Loading product...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!product) return <p>Product not found.</p>;

  return (
    <div>
      {product.image && <img src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)} alt={product.name} style={{ maxWidth: '400px', maxHeight: '400px' }} />}
      <h1>{product.name}</h1>
      <p>Producer: {product.producer_profile_username || 'N/A'}</p>
      <p>Description: {product.description || 'No description available.'}</p>
      <p>Rice Type: {product.rice_type}</p>
      <p>Available: {product.quantity_kg} kg</p>
      <p>Price: ¥{product.price_yen_per_kg} / kg</p>
      <hr/>
      {isAuthenticated && (
        <div>
            <h3>Order this Product</h3>
            <label>Quantity (kg): <input type="number" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value))} min="0.1" step="0.1" /></label>
            <br/>
            {addresses.length > 0 ? (
              <label>Delivery Address:
                <select value={selectedAddressId} onChange={e => setSelectedAddressId(e.target.value)}>
                  {addresses.map(addr => <option key={addr.id} value={String(addr.id)}>{addr.address_line1}, {addr.city}</option>)}
                </select>
              </label>
            ) : <p>No delivery addresses found. <Link to="/consumer/addresses">Add an address</Link></p>}
            <br/>
            <button onClick={handlePlaceOrder} disabled={!selectedAddressId && addresses.length > 0}>Place Order</button>
            {orderError && <p style={{color: 'red'}}>{orderError}</p>}
        </div>
      )}
      {!isAuthenticated && <p><Link to="/login">Log in</Link> to order this product.</p>}
    </div>
  );
};
export default ProductDetailPage;
