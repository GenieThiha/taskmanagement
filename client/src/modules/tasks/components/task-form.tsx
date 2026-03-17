import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../../shared/components/input';
import { Button } from '../../../shared/components/button';
import { createTask, updateTask, CreateTaskData } from '../../../api/task-api';
import { getProjects } from '../../../api/project-api';
import { getUsers } from '../../../api/user-api';
import { Task } from '../task-store';

interface TaskFormProps {
  task?: Task;
  onSuccess?: () => void;
}

export function TaskForm({ task, onSuccess }: TaskFormProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  const [form, setForm] = useState<CreateTaskData>({
    title: task?.title ?? '',
    description: task?.description ?? '',
    project_id: task?.project_id ?? '',
    assignee_id: task?.assignee_id ?? null,
    priority: task?.priority ?? 'medium',
    due_date: task?.due_date ?? null,
    status: task?.status ?? 'todo',
  });

  useEffect(() => {
    getProjects().then((res) => setProjects(res.data ?? [])).catch(() => {});
    getUsers().then((res) => setUsers(res.data ?? [])).catch(() => {});
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value || null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.project_id) {
      toast.error('Title and project are required');
      return;
    }

    setLoading(true);
    try {
      if (task) {
        await updateTask(task.id, form);
        toast.success('Task updated');
      } else {
        await createTask(form);
        toast.success('Task created');
        navigate('/tasks');
      }
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Title"
        name="title"
        value={form.title}
        onChange={handleChange}
        placeholder="Task title"
        required
      />

      <div>
        <label className="form-label">Description</label>
        <textarea
          name="description"
          value={form.description ?? ''}
          onChange={handleChange}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label className="form-label">Project</label>
        <select
          name="project_id"
          value={form.project_id}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Assignee</label>
        <select
          name="assignee_id"
          value={form.assignee_id ?? ''}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Priority</label>
          <select
            name="priority"
            value={form.priority ?? 'medium'}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="form-label">Status</label>
          <select
            name="status"
            value={form.status ?? 'todo'}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">Due date</label>
        <input
          type="date"
          name="due_date"
          value={form.due_date?.split('T')[0] ?? ''}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving…' : task ? 'Update task' : 'Create task'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
