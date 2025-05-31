import React, { useEffect, useState, useCallback } from 'react';
import ProductCard from '../components/Consumer/ProductCard';
import productService from '../services/productService';
import { ProductData } from '../interfaces';

const ProductBrowsePage: React.FC = () => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { search?: string; user_lat?: number; user_lon?: number } = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (userLocation) {
        params.user_lat = userLocation.lat;
        params.user_lon = userLocation.lon;
      }
      const data = await productService.getPublicProducts(params);
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [userLocation, searchTerm]); // Dependency array for useCallback

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]); // fetchProducts is memoized by useCallback

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          // fetchProducts will be called due to userLocation change in useEffect dependency
        },
        (geoError) => {
          console.error("Geolocation error:", geoError);
          setError("Failed to get location. Please ensure location services are enabled.");
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Trigger search manually or on input change (debounced ideally)
  const handleSearchSubmit = (event?: React.FormEvent) => {
    if(event) event.preventDefault();
    fetchProducts();
  }


  return (
    <div>
      <h1>Browse Rice Products</h1>
      <div>
        <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={handleSearchChange}
        />
        <button onClick={() => handleSearchSubmit()}>Search</button>
        <button onClick={handleGetLocation} style={{ marginLeft: '10px' }}>Use My Location to Filter</button>
        {userLocation && <p>Filtering near: Lat {userLocation.lat.toFixed(3)}, Lon {userLocation.lon.toFixed(3)}</p>}
      </div>

      {loading && <p>Loading products...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px' }}>
          {products.length > 0 ? products.map(p => <ProductCard key={p.id} product={p} />) : <p>No products found matching your criteria.</p>}
        </div>
      )}
    </div>
  );
};
export default ProductBrowsePage;
