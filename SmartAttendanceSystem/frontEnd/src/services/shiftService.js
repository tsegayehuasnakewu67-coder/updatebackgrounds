import api from './api';

export const shiftService = {
  getSettings:    async ()        => (await api.get('/shift')).data.data,
  updateSettings: async (payload) => (await api.put('/shift', payload)).data,
};
