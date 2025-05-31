import React, { useEffect, useState } from 'react';
import AddressList from '../components/Consumer/AddressList';
import AddressForm from '../components/Consumer/AddressForm';
import consumerService from '../services/consumerService';
import { DeliveryAddressData } from '../interfaces';

const ManageAddressesPage: React.FC = () => {
  const [addresses, setAddresses] = useState<DeliveryAddressData[]>([]);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);


  const fetchAddresses = () => {
    setLoading(true);
    consumerService.getMyAddresses()
      .then(data => { setAddresses(data); setError(null); })
      .catch(err => setError(err.message || 'Failed to fetch addresses'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAddresses, []);

  const handleSaveAddress = async (addrData: DeliveryAddressData) => {
    setFormError(null);
    try {
      if (editingAddress && editingAddress.id) {
        await consumerService.updateAddress(editingAddress.id, addrData);
      } else {
        await consumerService.createAddress(addrData);
      }
      setEditingAddress(null);
      fetchAddresses(); // Refresh list
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save address');
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    if (window.confirm('Delete this address?')) {
      try {
        await consumerService.deleteAddress(addressId);
        fetchAddresses(); // Refresh list
      } catch (err: any) {
        setError(err.message || 'Failed to delete address');
      }
    }
  };

  if (loading) return <p>Loading addresses...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h2>Manage Delivery Addresses</h2>
      <h3>{editingAddress ? 'Edit Address' : 'Add New Address'}</h3>
      <AddressForm address={editingAddress} onSave={handleSaveAddress} error={formError} />
      {editingAddress && <button onClick={() => setEditingAddress(null)}>Cancel Edit</button>}
      <hr/>
      <h3>Your Addresses</h3>
      <AddressList addresses={addresses} onEdit={setEditingAddress} onDelete={handleDeleteAddress} />
    </div>
  );
};
export default ManageAddressesPage;
