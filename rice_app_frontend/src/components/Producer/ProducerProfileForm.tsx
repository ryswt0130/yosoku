import React, { useState, useEffect } from 'react';
import { ProducerProfileData } from '../../interfaces';
import producerService from '../../services/producerService'; // You'll create this

interface ProducerProfileFormProps {
  profile: ProducerProfileData | null; // Pass existing profile for editing
  onSave: (updatedProfile: ProducerProfileData) => void;
}

const ProducerProfileForm: React.FC<ProducerProfileFormProps> = ({ profile, onSave }) => {
  const [formData, setFormData] = useState<Partial<ProducerProfileData>>({
    business_name: '',
    address_latitude: '',
    address_longitude: '',
    delivery_radius_km: '',
    bio: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  useEffect(() => {
    if (profile) {
      setFormData({
        business_name: profile.business_name || '',
        address_latitude: profile.address_latitude || '',
        address_longitude: profile.address_longitude || '',
        delivery_radius_km: profile.delivery_radius_km || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!profile || !profile.id) {
      setError("Profile ID is missing. Cannot update.");
      return;
    }
    try {
      // Convert to numbers where appropriate before sending
      const dataToSave: Partial<ProducerProfileData> = {
        ...formData,
        address_latitude: formData.address_latitude ? parseFloat(formData.address_latitude as string) : undefined,
        address_longitude: formData.address_longitude ? parseFloat(formData.address_longitude as string) : undefined,
        delivery_radius_km: formData.delivery_radius_km ? parseFloat(formData.delivery_radius_km as string) : undefined,
      };
      const updated = await producerService.updateProducerProfile(profile.id, dataToSave);
      onSave(updated);
      setSuccess("Profile updated successfully!");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    }
  };

  if (!profile) return <p>Loading profile...</p>;

  return (
    <form onSubmit={handleSubmit}>
      <h2>Edit Producer Profile</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      <div>
        <label htmlFor="business_name">Business Name</label>
        <input type="text" name="business_name" value={formData.business_name} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="address_latitude">Latitude</label>
        <input type="number" step="any" name="address_latitude" value={formData.address_latitude} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="address_longitude">Longitude</label>
        <input type="number" step="any" name="address_longitude" value={formData.address_longitude} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="delivery_radius_km">Delivery Radius (km)</label>
        <input type="number" step="any" name="delivery_radius_km" value={formData.delivery_radius_km} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="bio">Bio/Description</label>
        <textarea name="bio" value={formData.bio} onChange={handleChange} />
      </div>
      <button type="submit">Save Profile</button>
    </form>
  );
};

export default ProducerProfileForm;
