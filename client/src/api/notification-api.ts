import { apiClient } from './axios-instance';

export async function getNotifications(params?: { limit?: number }) {
  const response = await apiClient.get('/notifications', { params });
  return response.data;
}

export async function markAsRead(id: string) {
  const response = await apiClient.patch(`/notifications/${id}`);
  return response.data.data;
}
