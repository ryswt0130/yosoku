import React from 'react';
import { DeliveryAddressData } from '../../interfaces';

interface AddressListProps {
  addresses: DeliveryAddressData[];
  onEdit: (address: DeliveryAddressData) => void;
  onDelete: (addressId: number) => void;
  onSetDefault?: (addressId: number) => void; // Optional: if backend handles default setting separately
}

const AddressList: React.FC<AddressListProps> = ({ addresses, onEdit, onDelete, onSetDefault }) => {
  if (addresses.length === 0) return <p>No addresses saved.</p>;
  return (
    <ul>
      {addresses.map(addr => (
        <li key={addr.id}>
          {addr.address_line1}, {addr.address_line2 ? addr.address_line2 + ',' : ''}
          {addr.city}, {addr.prefecture} {addr.postal_code} {addr.country}
          {addr.is_default && <strong> (Default)</strong>}
          <button onClick={() => onEdit(addr)}>Edit</button>
          <button onClick={() => addr.id && onDelete(addr.id)}>Delete</button>
          {/* {!addr.is_default && onSetDefault && addr.id && <button onClick={() => onSetDefault(addr.id)}>Set Default</button>} */}
        </li>
      ))}
    </ul>
  );
};
export default AddressList;
