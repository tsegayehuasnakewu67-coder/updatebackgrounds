import api from './api';

export const contactMessageService = {
  submit: async payload => (await api.post('/contact', payload)).data,
  list: async params => (await api.get('/admin/messages', { params })).data.data,
  get: async id => (await api.get(`/admin/messages/${id}`)).data.data.message,
  setStatus: async (id, status) => (await api.patch(`/admin/messages/${id}/status`, { status })).data.data.message,
  setRead: async (id, isRead) => (await api.patch(`/admin/messages/${id}/read`, { isRead })).data.data.message,
  reply: async (id, message) => (await api.post(`/admin/messages/${id}/replies`, { message })).data,
  remove: async id => (await api.delete(`/admin/messages/${id}`)).data,
  mine: async params => (await api.get('/messages/mine', { params })).data.data,
  getMine: async id => (await api.get(`/messages/mine/${id}`)).data.data.message,
};