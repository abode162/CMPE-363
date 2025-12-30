import axios from 'axios';

// Single API Gateway URL - all requests go through the gateway
const API_BASE = import.meta.env.VITE_API_URL || '';

// Create a single axios instance for all API calls
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Guest claim token key in localStorage
const GUEST_CLAIM_TOKEN_KEY = 'guest_claim_token';

// Add auth token to requests
const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Get or create guest claim token
const getGuestClaimToken = () => {
  let token = localStorage.getItem(GUEST_CLAIM_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(GUEST_CLAIM_TOKEN_KEY, token);
  }
  return token;
};

// Clear guest claim token (after claiming URLs)
const clearGuestClaimToken = () => {
  localStorage.removeItem(GUEST_CLAIM_TOKEN_KEY);
};

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - could trigger logout
      console.warn('Unauthorized request - token may be expired');
    }
    return Promise.reject(error);
  }
);

// ============================================
// Auth API
// ============================================
export const register = (data) => api.post('/api/auth/register', data);
export const login = (data) => api.post('/api/auth/login', data);
export const getMe = () => api.get('/api/auth/me');

// ============================================
// URL API
// ============================================
export const createUrl = (data) => {
  // Include guest claim token for anonymous URL creation
  const guestToken = getGuestClaimToken();
  return api.post('/api/urls', data, {
    headers: {
      'X-Guest-Claim-Token': guestToken,
    },
  });
};

export const getUrls = () => api.get('/api/urls');
export const getUrl = (shortCode) => api.get(`/api/urls/${shortCode}`);
export const deleteUrl = (shortCode) => api.delete(`/api/urls/${shortCode}`);

// Claim guest URLs after login/register
export const claimGuestUrls = () => {
  const guestToken = localStorage.getItem(GUEST_CLAIM_TOKEN_KEY);
  if (!guestToken) return Promise.resolve({ data: { claimed: 0 } });

  return api.post('/api/urls/claim', { claim_token: guestToken })
    .then((response) => {
      clearGuestClaimToken();
      return response;
    });
};

// ============================================
// Analytics API
// ============================================
export const getStats = (shortCode) => api.get(`/api/analytics/${shortCode}`);
export const getHistory = (shortCode, limit = 100, offset = 0) =>
  api.get(`/api/analytics/${shortCode}/history?limit=${limit}&offset=${offset}`);
export const getDaily = (shortCode, days = 30) =>
  api.get(`/api/analytics/${shortCode}/daily?days=${days}`);
export const getGeoStats = (shortCode) =>
  api.get(`/api/analytics/${shortCode}/geo`);

// ============================================
// Utility exports
// ============================================
export {
  setAuthToken,
  getGuestClaimToken,
  clearGuestClaimToken,
  api as axiosInstance
};
