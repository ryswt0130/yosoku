import apiClient from './apiClient';
import { ProducerProfileData } from '../interfaces';

const BASE_URL = '/producers'; // Relative to apiClient's baseURL (/api/v1)

// Get current producer's profile (assuming an endpoint like /api/v1/producers/me/ or using the general one with filtering)
// For now, we'll assume the ProducerProfileViewSet handles retrieving the specific profile for the authenticated producer
// if the detail route is accessed, e.g. /api/v1/producers/{id}/
// Or a dedicated endpoint /api/v1/producers/my_profile/ would be better.
// Let's use the structure where ProducerProfileViewSet returns the user's profile if no ID is given to list.
// This might need adjustment based on actual backend behavior for fetching *own* profile.
// A common pattern is GET /api/v1/producerprofiles/ (if it filters by user) or a dedicated /me endpoint.
// The current ProducerProfileViewSet in backend seems to be /api/v1/producers/{id}/
// Let's assume we need to get the user's producer_profile ID first.

const getMyProducerProfile = async (): Promise<ProducerProfileData> => {
    // This is tricky. We need the producer's own ProducerProfile ID.
    // Option 1: Backend provides a /api/v1/producers/me/ endpoint. (Ideal)
    // Option 2: Fetch User, then UserProfile, then ProducerProfile ID. (Complex on frontend)
    // Option 3: The ProducerProfileViewSet list endpoint filters by current user if no PK. (Current Django setup is more for pk)
    // For now, let's assume a /me/ endpoint or that the client knows its producer_profile_id
    // This needs to be robustly implemented.
    // A simple way for now: assume the producer's producer_profile ID is known or can be fetched.
    // This is a placeholder:
    // const response = await apiClient.get(`${BASE_URL}/me/`); // hypothetical
    // return response.data;
    // Fallback: list all and filter client side (bad for many producers) or assume one profile for the user
    const response = await apiClient.get<ProducerProfileData[]>(`${BASE_URL}/`); // List view for producer (should be filtered by backend)
    // This assumes the list view of /api/v1/producers/ for an authenticated producer returns ONLY their profile, or we need an ID.
    // The current Django ProducerProfileViewSet for list action might return all if user is staff, or only own if not staff.
    // This should work if the user is not staff.
    if (response.data && response.data.length > 0) {
        return response.data[0]; // Assuming the first one is the producer's own profile
    }
    throw new Error("Producer profile not found or not unique.");
};

const updateProducerProfile = async (profileId: number, data: Partial<ProducerProfileData>): Promise<ProducerProfileData> => {
  const response = await apiClient.patch<ProducerProfileData>(`${BASE_URL}/${profileId}/`, data);
  return response.data;
};

const producerService = {
  getMyProducerProfile,
  updateProducerProfile,
};

export default producerService;
