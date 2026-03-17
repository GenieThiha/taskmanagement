import { create } from 'zustand';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  assignee_id: string | null;
  reporter_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; full_name: string; email: string } | null;
  reporter?: { id: string; full_name: string; email: string } | null;
  project?: { id: string; name: string } | null;
}

export interface TaskFilters {
  project_id?: string;
  assignee_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

interface TaskState {
  tasks: Task[];
  filters: TaskFilters;
  total: number;
  page: number;
  setTasks: (tasks: Task[], total: number, page: number) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  resetFilters: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  filters: {},
  total: 0,
  page: 1,

  setTasks: (tasks, total, page) => set({ tasks, total, page }),

  updateTaskStatus: (id, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () => set({ filters: {} }),
}));
