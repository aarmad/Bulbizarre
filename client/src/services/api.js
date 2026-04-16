import axios from 'axios'

const baseURL = import.meta.env.DEV
  ? 'http://localhost:5000/api'
  : '/api'

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
}

export const verifyApi = {
  chat:          (query, userId) => api.post('/verify/chat', { query, userId }),
  url:           (url, userId)   => api.post('/verify/url',  { url, userId }),
  history:       (userId)        => api.get('/verify/history', { params: { userId } }),
  deleteHistory: (id, userId)    => api.delete(`/verify/history/${id}`, { params: { userId } }),
  clearHistory:  (userId)        => api.delete('/verify/history', { params: { userId } }),
}

export default api
