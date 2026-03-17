import { apiClient } from './axios-instance';

export interface UserFilters {
  page?: number;
  limit?: number;
  role?: string;
}

export interface UpdateUserData {
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

export async function getUsers(params?: UserFilters) {
  const response = await apiClient.get('/users', { params });
  return response.data;
}

export async function getUser(id: string) {
  const response = await apiClient.get(`/users/${id}`);
  return response.data.data;
}

export async function updateUser(id: string, data: UpdateUserData) {
  const response = await apiClient.patch(`/users/${id}`, data);
  return response.data.data;
}
