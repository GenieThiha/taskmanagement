import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Task } from '../task-store';
import { Badge } from '../../../shared/components/badge';
import { Avatar } from '../../../shared/components/avatar';
import { formatDate } from '../../../shared/utils/format-date';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="card cursor-grab active:cursor-grabbing mb-3 hover:shadow-md transition-shadow"
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{task.title}</p>
        <Badge type="priority" value={task.priority} />
      </div>

      {task.project && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{task.project.name}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        {task.due_date && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(task.due_date)}</span>
        )}
        {task.assignee && (
          <Avatar fullName={task.assignee.full_name} size="sm" />
        )}
      </div>
    </div>
  );
}
