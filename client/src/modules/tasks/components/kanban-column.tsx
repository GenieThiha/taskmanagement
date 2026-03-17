import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '../task-store';
import { TaskCard } from './task-card';
import { Badge } from '../../../shared/components/badge';

const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
}

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <Badge type="status" value={status} />
        <span className="text-sm font-semibold text-gray-700">{COLUMN_LABELS[status]}</span>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : 'bg-gray-100'
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">Drop tasks here</p>
        )}
      </div>
    </div>
  );
}
