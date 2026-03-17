import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Task, TaskStatus, useTaskStore } from '../task-store';
import { KanbanColumn } from './kanban-column';
import { TaskCard } from './task-card';
import { patchTask } from '../../../api/task-api';

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

interface KanbanBoardProps {
  tasks: Task[];
}

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  const { updateTaskStatus } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Memoised so the expensive reduce+filter only reruns when the task list
  // actually changes — not on every drag-over re-render.
  const tasksByStatus = useMemo(
    () =>
      STATUSES.reduce<Record<TaskStatus, Task[]>>(
        (acc, status) => {
          acc[status] = tasks.filter((t) => t.status === status);
          return acc;
        },
        { todo: [], in_progress: [], review: [], done: [] }
      ),
    [tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;

    // over.id is either a column status string or a task UUID (when dropped onto a card)
    let newStatus: TaskStatus;
    if (STATUSES.includes(over.id as TaskStatus)) {
      newStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      newStatus = overTask.status;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    updateTaskStatus(taskId, newStatus);

    try {
      await patchTask(taskId, { status: newStatus });
    } catch {
      // Revert on failure
      updateTaskStatus(taskId, task.status);
      toast.error('Failed to update task status');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} tasks={tasksByStatus[status]} />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}
