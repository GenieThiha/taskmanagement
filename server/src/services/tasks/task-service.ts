import { Op, fn, col } from 'sequelize';
import { Task, TaskStatus, TaskPriority } from '../../models/task.model';
import { Comment } from '../../models/comment.model';
import { User } from '../../models/user.model';
import { Project } from '../../models/project.model';
import { notify } from '../notifications/notification-service';
import { logger } from '../../logger/logger';

interface TaskFilters {
  project_id?: string;
  assignee_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  page?: number;
  limit?: number;
}

export async function getTaskStats() {
  // Single aggregation query — returns all four status counts in one round-trip
  // instead of the four separate filtered requests the dashboard previously used.
  const rows = (await Task.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    where: { is_deleted: false },
    group: ['status'],
    raw: true,
  })) as unknown as Array<{ status: string; count: string }>;

  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.status] = parseInt(r.count, 10);
  }

  return {
    todo:        map['todo']        ?? 0,
    in_progress: map['in_progress'] ?? 0,
    review:      map['review']      ?? 0,
    done:        map['done']        ?? 0,
  };
}

export async function getTasks(filters: TaskFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { is_deleted: false };
  if (filters.project_id) where.project_id = filters.project_id;
  if (filters.assignee_id) where.assignee_id = filters.assignee_id;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;

  const { count, rows } = await Task.findAndCountAll({
    where,
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
      { model: User, as: 'reporter', attributes: ['id', 'full_name', 'email'] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    data: rows,
    meta: { total: count, page, limit, total_pages: Math.ceil(count / limit) },
  };
}

export async function createTask(
  data: {
    title: string;
    description?: string | null;
    project_id: string;
    assignee_id?: string | null;
    priority?: TaskPriority;
    due_date?: Date | null;
    status?: TaskStatus;
  },
  reporterId: string
) {
  const task = await Task.create({ ...data, reporter_id: reporterId });

  // Async notification if assignee set
  if (data.assignee_id) {
    notify(
      'task_assigned',
      task.id,
      'task',
      [data.assignee_id],
      `You have been assigned task: ${data.title}`
    ).catch((err) => logger.warn('Notification error', { err }));
  }

  return task;
}

export async function getTask(
  id: string,
  commentPage = 1,
  commentLimit = 20
) {
  const commentOffset = (commentPage - 1) * commentLimit;

  const task = await Task.findOne({
    where: { id, is_deleted: false },
    include: [
      {
        model: Comment,
        as: 'comments',
        where: { is_deleted: false },
        required: false,
        // `separate: true` runs comments as a second query so that limit/offset
        // apply only to comments and don't interfere with the parent row count.
        separate: true,
        limit: commentLimit,
        offset: commentOffset,
        order: [['created_at', 'ASC']],
        include: [
          { model: User, as: 'author', attributes: ['id', 'full_name', 'email'] },
        ],
      },
      { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
      { model: User, as: 'reporter', attributes: ['id', 'full_name', 'email'] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
  });

  if (!task) {
    const err = new Error('Task not found');
    (err as any).status = 404;
    throw err;
  }

  return task;
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    project_id?: string;
    assignee_id?: string | null;
    priority?: TaskPriority;
    due_date?: Date | null;
    status?: TaskStatus;
  }
) {
  const task = await Task.findOne({ where: { id, is_deleted: false } });
  if (!task) {
    const err = new Error('Task not found');
    (err as any).status = 404;
    throw err;
  }

  const prevAssignee = task.assignee_id;
  const prevStatus = task.status;

  await task.update(data);

  // Trigger notifications asynchronously
  const recipients: string[] = [];
  if (task.assignee_id && task.assignee_id !== prevAssignee) {
    recipients.push(task.assignee_id);
    notify(
      'task_assigned',
      task.id,
      'task',
      [task.assignee_id],
      `You have been assigned task: ${task.title}`
    ).catch((err) => logger.warn('Notification error', { err }));
  } else if (task.status !== prevStatus || data.assignee_id !== prevAssignee) {
    const notifyIds = [
      task.assignee_id,
      task.reporter_id,
    ].filter(Boolean) as string[];
    if (notifyIds.length > 0) {
      notify(
        'task_updated',
        task.id,
        'task',
        notifyIds,
        `Task "${task.title}" has been updated`
      ).catch((err) => logger.warn('Notification error', { err }));
    }
  }

  return task;
}

export async function patchTask(id: string, data: Partial<typeof updateTask>) {
  return updateTask(id, data as any);
}

export async function deleteTask(id: string) {
  const task = await Task.findOne({ where: { id, is_deleted: false } });
  if (!task) {
    const err = new Error('Task not found');
    (err as any).status = 404;
    throw err;
  }
  await task.update({ is_deleted: true });
}

export async function addComment(
  taskId: string,
  authorId: string,
  body: string
) {
  const task = await Task.findOne({ where: { id: taskId, is_deleted: false } });
  if (!task) {
    const err = new Error('Task not found');
    (err as any).status = 404;
    throw err;
  }

  const comment = await Comment.create({ task_id: taskId, author_id: authorId, body });

  // Notify assignee and reporter (not the comment author)
  const notifyIds = [task.assignee_id, task.reporter_id]
    .filter((id): id is string => !!id && id !== authorId);

  if (notifyIds.length > 0) {
    notify(
      'task_commented',
      comment.id,
      'comment',
      notifyIds,
      `New comment on task: ${task.title}`
    ).catch((err) => logger.warn('Notification error', { err }));
  }

  return comment;
}
