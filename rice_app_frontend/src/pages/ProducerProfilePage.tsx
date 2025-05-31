import React, { useEffect, useState } from 'react';
import ProducerProfileForm from '../components/Producer/ProducerProfileForm';
import producerService from '../services/producerService';
import { ProducerProfileData } from '../interfaces';
import { useAuth } from '../hooks/useAuth';

const ProducerProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProducerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userToken } = useAuth();

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await producerService.getMyProducerProfile();
      setProfile(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch producer profile');
      setProfile(null); // Ensure no stale profile data on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(userToken) { // Fetch only if logged in
        fetchProfile();
    }
  }, [userToken]);

  const handleSaveProfile = (updatedProfile: ProducerProfileData) => {
    setProfile(updatedProfile); // Update local state with saved data
  };

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  // if (!profile) return <p>No producer profile found. This might indicate an issue or incomplete registration.</p>;


  return (
    <div>
      <h1>My Producer Profile</h1>
      <ProducerProfileForm profile={profile} onSave={handleSaveProfile} />
    </div>
  );
};

export default ProducerProfilePage;
