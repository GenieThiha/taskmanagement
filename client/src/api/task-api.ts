import { apiClient } from './axios-instance';

export interface TaskFilters {
  project_id?: string;
  assignee_id?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface CreateTaskData {
  title: string;
  description?: string | null;
  project_id: string;
  assignee_id?: string | null;
  priority?: string;
  due_date?: string | null;
  status?: string;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {}

export async function getTasks(params?: TaskFilters) {
  const response = await apiClient.get('/tasks', { params });
  return response.data;
}

export async function createTask(data: CreateTaskData) {
  const response = await apiClient.post('/tasks', data);
  return response.data.data;
}

export async function getTask(id: string) {
  const response = await apiClient.get(`/tasks/${id}`);
  return response.data.data;
}

export async function updateTask(id: string, data: UpdateTaskData) {
  const response = await apiClient.put(`/tasks/${id}`, data);
  return response.data.data;
}

export async function patchTask(id: string, data: UpdateTaskData) {
  const response = await apiClient.patch(`/tasks/${id}`, data);
  return response.data.data;
}

export async function deleteTask(id: string) {
  await apiClient.delete(`/tasks/${id}`);
}

export async function addComment(taskId: string, body: string) {
  const response = await apiClient.post(`/tasks/${taskId}/comments`, { body });
  return response.data.data;
}

export interface TaskStats {
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

// Single-request replacement for the four per-status getTasks calls on the dashboard.
export async function getTaskStats(): Promise<TaskStats> {
  const response = await apiClient.get('/tasks/stats');
  return response.data.data;
}
