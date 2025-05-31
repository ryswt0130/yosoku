import React, { useEffect, useState } from 'react';
import ProducerProfileForm from '../components/Producer/ProducerProfileForm';
import producerService from '../services/producerService';
import { ProducerProfileData } from '../interfaces';
import { useAuth } from '../hooks/useAuth';

const ProducerProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProducerProfileData | null>(null);
  const [loading, setLoading] = useState(true); // For initial fetch
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { userToken } = useAuth();

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      // Assuming getMyProducerProfile correctly fetches the logged-in producer's profile
      const data = await producerService.getMyProducerProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch producer profile. Ensure you have a producer profile setup.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(userToken) {
        fetchProfile();
    } else {
        setError("User not authenticated."); // Should be caught by ProtectedRoute mostly
        setLoading(false);
    }
  }, [userToken]);

  const handleSaveProfile = async (profileDataToSave: ProducerProfileData) => {
    if (!profile || !profile.id) {
      setError("Profile ID is missing. Cannot update.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // We pass only the fields that can be updated.
      // The backend serializer should handle partial updates (PATCH).
      const dataToSend: Partial<ProducerProfileData> = {
        business_name: profileDataToSave.business_name,
        address_latitude: profileDataToSave.address_latitude,
        address_longitude: profileDataToSave.address_longitude,
        delivery_radius_km: profileDataToSave.delivery_radius_km,
        bio: profileDataToSave.bio,
      };

      const updated = await producerService.updateProducerProfile(profile.id, dataToSend);
      setProfile(updated); // Update local state with fully saved data from backend
      setSuccess("Profile updated successfully!");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <p>Loading profile...</p>;
  // Error for initial fetch
  if (error && !profile) return <p style={{ color: 'red' }}>Error: {error}</p>;
  // If profile is null after loading and no error, it means not found or not created yet.
  if (!profile && !loading) return <p>Producer profile not found. Please ensure it's created (this might happen automatically on registration as producer, or needs a creation step).</p>;


  return (
    <div>
      <h1>My Producer Profile</h1>
      {/* Pass specific error/success for the form if needed, or use the page-level ones */}
      <ProducerProfileForm
        profile={profile}
        onSave={handleSaveProfile}
        isLoading={isSaving}
        error={error} /* Pass page error to form to display */
        success={success}
      />
    </div>
  );
};

export default ProducerProfilePage;
