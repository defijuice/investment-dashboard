import axios from 'axios';

const API_BASE_URL = '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 요청 인터셉터: 토큰 추가
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401 에러 처리
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;

// Auth API
export const authApi = {
  login: (password) => client.post('/auth/login', { password }),
  verify: () => client.get('/auth/verify')
};

// Operators API
export const operatorsApi = {
  list: (params) => client.get('/operators', { params }),
  get: (id) => client.get(`/operators/${id}`),
  create: (data) => client.post('/operators', data),
  update: (id, data) => client.put(`/operators/${id}`, data),
  checkSimilar: (names) => client.post('/operators/check-similar', { names })
};

// Projects API
export const projectsApi = {
  list: (params) => client.get('/projects', { params }),
  get: (id) => client.get(`/projects/${id}`),
  create: (data) => client.post('/projects', data),
  update: (id, data) => client.put(`/projects/${id}`, data),
  linkFile: (id, fileType, fileId) => client.put(`/projects/${id}/link-file`, { fileType, fileId }),
  updateStatus: (id) => client.post(`/projects/${id}/update-status`)
};

// Applications API
export const applicationsApi = {
  list: (params) => client.get('/applications', { params }),
  get: (id) => client.get(`/applications/${id}`),
  create: (data) => client.post('/applications', data),
  update: (id, data) => client.put(`/applications/${id}`, data),
  batchUpdateStatus: (ids, status) => client.put('/applications/batch/status', { ids, status }),
  delete: (id) => client.delete(`/applications/${id}`)
};

// Files API
export const filesApi = {
  list: (params) => client.get('/files', { params }),
  get: (id) => client.get(`/files/${id}`),
  update: (id, data) => client.put(`/files/${id}`, data),
  syncStatus: (id) => client.post(`/files/${id}/sync-status`),
  getApplications: (id) => client.get(`/files/${id}/applications`)
};

// Stats API
export const statsApi = {
  dashboard: () => client.get('/stats/dashboard'),
  topOperators: (params) => client.get('/stats/top-operators', { params })
};
