import { apiClient } from './axios-instance';

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export async function register(data: RegisterData) {
  const response = await apiClient.post('/auth/register', data);
  return response.data.data;
}

export async function login(data: LoginData) {
  const response = await apiClient.post('/auth/login', data);
  return response.data.data;
}

export async function refresh() {
  // Refresh token lives in an httpOnly cookie; withCredentials sends it automatically.
  const response = await apiClient.post('/auth/refresh');
  return response.data.data;
}

export async function logout() {
  const response = await apiClient.post('/auth/logout');
  return response.data;
}

export async function forgotPassword(email: string) {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data.data;
}

export async function resetPassword(token: string, password: string) {
  const response = await apiClient.patch('/auth/reset-password', {
    token,
    new_password: password,
  });
  return response.data.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await apiClient.patch('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data.data;
}
