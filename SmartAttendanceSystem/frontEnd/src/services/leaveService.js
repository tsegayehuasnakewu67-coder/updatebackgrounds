import api from './api';
import { getOnce } from './inFlightGet';

export const leaveService = {
  list: async (params = {}) => {
    const key = `leaves:${JSON.stringify(params)}`;
    return getOnce(key, async () => (await api.get('/leaves', { params })).data.data);
  },
  create: async payload => (await api.post('/leaves', payload)).data,
  review: async (id, payload) => (await api.patch(`/leaves/${id}/review`, payload)).data,
};
