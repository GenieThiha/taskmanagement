import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTasks } from '../../../api/task-api';
import { useTaskStore, TaskStatus, TaskPriority } from '../task-store';
import { KanbanBoard } from '../components/kanban-board';
import { Button } from '../../../shared/components/button';
import { Modal } from '../../../shared/components/modal';
import { TaskForm } from '../components/task-form';

export function TaskListPage() {
  const { tasks, filters, setTasks, setFilters } = useTaskStore();
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Serialise filters to a stable primitive so the effect only re-runs when
  // the actual values change, not on every object identity change from the store.
  const filtersKey = JSON.stringify(filters);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTasks(filters);
      setTasks(result.data ?? [], result.meta?.total ?? 0, result.meta?.page ?? 1);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, setTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === 'kanban' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm"
          value={filters.status ?? ''}
          onChange={(e) => setFilters({ status: e.target.value as TaskStatus || undefined })}
        >
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm"
          value={filters.priority ?? ''}
          onChange={(e) => setFilters({ priority: e.target.value as TaskPriority || undefined })}
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard tasks={tasks} />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{task.title}</p>
                <p className="text-xs text-gray-500">{task.project?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 capitalize">{task.status.replace('_', ' ')}</span>
                <span className="text-xs text-gray-500 capitalize">{task.priority}</span>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center py-12 text-gray-500">No tasks found</p>
          )}
        </div>
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Task"
      >
        <TaskForm onSuccess={() => { setShowCreate(false); fetchTasks(); }} />
      </Modal>
    </div>
  );
}
