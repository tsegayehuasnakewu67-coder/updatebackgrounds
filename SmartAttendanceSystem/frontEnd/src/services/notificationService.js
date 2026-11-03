import api from './api';
import { getOnce } from './inFlightGet';

export const notificationService = {
  list: async params => (await api.get('/notifications', { params })).data.data.notifications,
  summary: async params => {
    const key = `notifications:summary:${JSON.stringify(params || {})}`;
    return getOnce(key, async () => (await api.get('/notifications', { params })).data.data);
  },
  unreadCount: async type => (await api.get('/notifications/unread-count', {
    params: type ? { type } : undefined,
  })).data.data.count,
  send: async payload => (await api.post('/notifications', payload)).data,
  markRead: async id => (await api.patch(`/notifications/${id}/read`)).data.data,
};
