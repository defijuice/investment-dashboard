import axios from 'axios';

const API_KEY = localStorage.getItem('apiKey') || '';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for API key
client.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('apiKey');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('apiKey');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;

// Auth
export const setApiKey = (key) => {
  localStorage.setItem('apiKey', key);
};

export const clearApiKey = () => {
  localStorage.removeItem('apiKey');
};

// Stats
export const fetchDashboardStats = (years = 5) =>
  client.get('/stats/dashboard', { params: { years } });
export const fetchTopOperators = (years = 3, limit = 10) =>
  client.get('/stats/top-operators', { params: { years, limit } });
export const fetchTopOperatorsByAmount = (years = 3, limit = 10) =>
  client.get('/stats/top-operators-by-amount', { params: { years, limit } });
export const fetchCategoryBreakdown = (years = 3) =>
  client.get('/stats/category-breakdown', { params: { years } });

// Operators
export const fetchOperators = (params) => client.get('/operators', { params });
export const fetchOperator = (id) => client.get(`/operators/${id}`);
export const fetchOperatorProfile = (id) => client.get(`/operators/${id}/profile`);
export const fetchOperatorTimeline = (id, years = 10) =>
  client.get(`/operators/${id}/timeline`, { params: { years } });
export const fetchOperatorWinRate = (id, years = 3) =>
  client.get(`/operators/${id}/win-rate`, { params: { years } });

// Applications
export const fetchApplications = (params) => client.get('/applications', { params });
export const searchApplicationsAdvanced = (params) =>
  client.get('/applications/search/advanced', { params });
export const fetchSearchOptions = () => client.get('/applications/search/options');
export const createManualRejected = (data) => client.post('/applications/manual/rejected', data);
export const updateApplication = (id, data) => client.put(`/applications/${id}`, data);

// Projects
export const fetchProjects = (params) => client.get('/projects', { params });
export const fetchProject = (id) => client.get(`/projects/${id}`);
export const fetchProjectDetail = (id) => client.get(`/projects/${id}/detail`);

// Files
export const fetchFiles = (params) => client.get('/files', { params });
export const fetchFileDetail = (id) => client.get(`/files/${id}`);
export const fetchFileApplications = (id) => client.get(`/files/${id}/applications`);
export const syncFileStatus = (id) => client.post(`/files/${id}/sync-status`);
