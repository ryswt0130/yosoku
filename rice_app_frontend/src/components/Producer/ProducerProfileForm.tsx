import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import { LatLngExpression, LatLngTuple, Icon } from 'leaflet';
import { ProducerProfileData } from '../../interfaces';
// import producerService from '../../services/producerService'; // Already imported in page

// Fix for default Leaflet icon issue with bundlers like Webpack
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


interface ProducerProfileFormProps {
  profile: ProducerProfileData | null;
  onSave: (updatedProfile: ProducerProfileData) => void; // Changed to send full profile, not just FormData
  isLoading?: boolean; // Added for consistency
  error?: string | null; // Added for consistency
  success?: string | null; // Added
}

// Component to handle map clicks and marker updates
const LocationPicker: React.FC<{ position: LatLngTuple, setPosition: (pos: LatLngTuple) => void }> = ({ position, setPosition }) => {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  // Optional: Update map view when position changes externally (e.g. manual input)
  // useEffect(() => {
  //   map.setView(position, map.getZoom());
  // }, [position, map]);


  return position ? <Marker position={position} draggable={true} eventHandlers={{
    dragend: (e) => {
      const newPos = e.target.getLatLng();
      setPosition([newPos.lat, newPos.lng]);
    }
  }} /> : null;
};

const ProducerProfileForm: React.FC<ProducerProfileFormProps> = ({ profile, onSave, isLoading, error, success }) => {
  const [formData, setFormData] = useState<Partial<ProducerProfileData>>({
    business_name: '', address_latitude: '', address_longitude: '', delivery_radius_km: '', bio: ''
  });

  // Map state: default to a central Japan location if no profile data
  const defaultMapCenter: LatLngTuple = [35.6895, 139.6917]; // Tokyo
  const [mapPosition, setMapPosition] = useState<LatLngTuple>(defaultMapCenter);
  const [mapRadius, setMapRadius] = useState<number>(0); // In meters for Leaflet Circle

  useEffect(() => {
    if (profile) {
      setFormData({
        business_name: profile.business_name || '',
        address_latitude: profile.address_latitude || '',
        address_longitude: profile.address_longitude || '',
        delivery_radius_km: profile.delivery_radius_km || '',
        bio: profile.bio || '',
      });
      const lat = parseFloat(String(profile.address_latitude));
      const lon = parseFloat(String(profile.address_longitude));
      const rad = parseFloat(String(profile.delivery_radius_km));

      if (!isNaN(lat) && !isNaN(lon)) {
        setMapPosition([lat, lon]);
      } else {
        setMapPosition(defaultMapCenter); // Reset if invalid
      }
      if (!isNaN(rad) && rad > 0) {
        setMapRadius(rad * 1000); // Convert km to meters for Leaflet Circle
      } else {
        setMapRadius(0);
      }
    }
  }, [profile]);

  // Update form fields when mapPosition changes (e.g. from map click/drag)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      address_latitude: mapPosition[0].toFixed(6),
      address_longitude: mapPosition[1].toFixed(6),
    }));
  }, [mapPosition]);

  // Update mapRadius when delivery_radius_km form field changes
  useEffect(() => {
    const radKm = parseFloat(String(formData.delivery_radius_km));
    if (!isNaN(radKm) && radKm >= 0) {
      setMapRadius(radKm * 1000);
    } else {
      setMapRadius(0); // Or a default small radius if input is invalid
    }
  }, [formData.delivery_radius_km]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // If lat/lon fields are changed manually, update map position
    if (name === 'address_latitude' || name === 'address_longitude') {
        const newLat = name === 'address_latitude' ? parseFloat(value) : parseFloat(String(formData.address_latitude));
        const newLon = name === 'address_longitude' ? parseFloat(value) : parseFloat(String(formData.address_longitude));
        if(!isNaN(newLat) && !isNaN(newLon)) {
            setMapPosition([newLat, newLon]);
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Parent component (ProducerProfilePage) will handle the actual saving via onSave
    // Ensure data sent up is correctly formatted (numbers for geo fields)
    const dataToSave: ProducerProfileData = {
      ...profile, // include any existing profile fields like id, user_profile
      business_name: formData.business_name,
      address_latitude: formData.address_latitude ? parseFloat(String(formData.address_latitude)) : undefined,
      address_longitude: formData.address_longitude ? parseFloat(String(formData.address_longitude)) : undefined,
      delivery_radius_km: formData.delivery_radius_km ? parseFloat(String(formData.delivery_radius_km)) : undefined,
      bio: formData.bio,
    };
    onSave(dataToSave);
  };

  // Helper to re-center map if lat/lon input changes
  const MapViewUpdater: React.FC<{ center: LatLngTuple, zoom: number }> = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
  }


  return (
    <form onSubmit={handleSubmit}>
      <h2>Edit Producer Profile</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      <div>
        <label htmlFor="business_name">Business Name:</label>
        <input type="text" name="business_name" id="business_name" value={formData.business_name || ''} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="address_latitude">Latitude:</label>
        <input type="number" step="any" name="address_latitude" id="address_latitude" value={formData.address_latitude || ''} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="address_longitude">Longitude:</label>
        <input type="number" step="any" name="address_longitude" id="address_longitude" value={formData.address_longitude || ''} onChange={handleChange} />
      </div>
      <div>
        <label htmlFor="delivery_radius_km">Delivery Radius (km):</label>
        <input type="number" step="any" name="delivery_radius_km" id="delivery_radius_km" value={formData.delivery_radius_km || ''} onChange={handleChange} />
      </div>

      <div style={{ height: '400px', width: '100%', marginTop: '20px', marginBottom: '20px' }}>
        <MapContainer center={mapPosition} zoom={profile?.address_latitude ? 13 : 6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <LocationPicker position={mapPosition} setPosition={setMapPosition} />
          {mapRadius > 0 && <Circle center={mapPosition} radius={mapRadius} pathOptions={{ color: 'blue' }} />}
          <MapViewUpdater center={mapPosition} zoom={profile?.address_latitude && mapRadius > 0 ? 13 - Math.log2(mapRadius/5000) : (profile?.address_latitude ? 13 : 6) } />
        </MapContainer>
      </div>

      <div>
        <label htmlFor="bio">Bio/Description:</label>
        <textarea name="bio" id="bio" value={formData.bio || ''} onChange={handleChange} />
      </div>
      <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Profile'}</button>
    </form>
  );
};

export default ProducerProfileForm;
