import { apiClient } from './axios-instance';

export interface ProjectFilters {
  page?: number;
  limit?: number;
  status?: string;
}

export interface CreateProjectData {
  name: string;
  description?: string | null;
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  status?: string;
}

export async function getProjects(params?: ProjectFilters) {
  const response = await apiClient.get('/projects', { params });
  return response.data;
}

export async function getProject(id: string) {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data.data;
}

export async function createProject(data: CreateProjectData) {
  const response = await apiClient.post('/projects', data);
  return response.data.data;
}

export async function updateProject(id: string, data: UpdateProjectData) {
  const response = await apiClient.put(`/projects/${id}`, data);
  return response.data.data;
}

export async function archiveProject(id: string) {
  const response = await apiClient.delete(`/projects/${id}`);
  return response.data.data;
}
