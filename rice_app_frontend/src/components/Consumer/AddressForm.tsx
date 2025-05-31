import React, { useState, useEffect } from 'react';
import { DeliveryAddressData } from '../../interfaces';

interface AddressFormProps {
  address?: DeliveryAddressData | null;
  onSave: (addressData: DeliveryAddressData) => void;
  isLoading?: boolean;
  error?: string | null;
}

const AddressForm: React.FC<AddressFormProps> = ({ address, onSave, isLoading, error }) => {
  const [formData, setFormData] = useState<DeliveryAddressData>({
    address_line1: '', city: '', prefecture: '', postal_code: '', is_default: false, country: 'Japan'
  });

  useEffect(() => {
    if (address) {
      setFormData(address);
    } else {
      setFormData({ address_line1: '', city: '', prefecture: '', postal_code: '', is_default: false, country: 'Japan' });
    }
  }, [address]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div><label>Address Line 1: <input type="text" name="address_line1" value={formData.address_line1} onChange={handleChange} required /></label></div>
      <div><label>Address Line 2 (Optional): <input type="text" name="address_line2" value={formData.address_line2 || ''} onChange={handleChange} /></label></div>
      <div><label>City: <input type="text" name="city" value={formData.city} onChange={handleChange} required /></label></div>
      <div><label>Prefecture: <input type="text" name="prefecture" value={formData.prefecture} onChange={handleChange} required /></label></div>
      <div><label>Postal Code: <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} required /></label></div>
      <div><label>Country: <input type="text" name="country" value={formData.country || 'Japan'} onChange={handleChange} required /></label></div>
      <div><label><input type="checkbox" name="is_default" checked={formData.is_default || false} onChange={handleChange} /> Set as default</label></div>
      <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Address'}</button>
    </form>
  );
};
export default AddressForm;
