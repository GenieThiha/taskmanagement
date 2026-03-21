import { Op, fn, col } from 'sequelize';
import { Task, TaskStatus, TaskPriority } from '../../models/task.model';
import { Comment } from '../../models/comment.model';
import { User, UserRole } from '../../models/user.model';
import { Project } from '../../models/project.model';
import { notify } from '../notifications/notification-service';
import { logger } from '../../logger/logger';
import pLimit from 'p-limit';

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

export async function getTasks(
  filters: TaskFilters,
  requesterId: string,
  requesterRole: UserRole
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { is_deleted: false };
  if (filters.project_id) where.project_id = filters.project_id;
  if (filters.assignee_id) where.assignee_id = filters.assignee_id;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;

  // Members can only see tasks they are assigned to or reported
  if (requesterRole === 'member') {
    where[Op.or as any] = [
      { assignee_id: requesterId },
      { reporter_id: requesterId },
    ];
  }

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
  const project = await Project.findByPk(data.project_id, { attributes: ['id', 'status'] });
  if (!project) {
    const err = new Error('Project not found');
    (err as any).status = 404;
    throw err;
  }
  if (project.status === 'archived') {
    const err = new Error('Cannot create tasks in an archived project');
    (err as any).status = 400;
    throw err;
  }

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
  requesterId: string,
  requesterRole: UserRole,
  commentPage = 1,
  commentLimit = 20
) {
  const commentOffset = (commentPage - 1) * commentLimit;

  const task = await Task.findOne({
    where: { id, is_deleted: false },
    include: [
      // Cast to `any`: Sequelize 6 IncludeOptions types omit `limit`/`offset`
      // even though both are valid (and required) when `separate: true` is set.
      {
        model: Comment,
        as: 'comments',
        where: { is_deleted: false },
        required: false,
        separate: true,
        limit: commentLimit,
        offset: commentOffset,
        order: [['created_at', 'ASC']],
        include: [
          { model: User, as: 'author', attributes: ['id', 'full_name', 'email'] },
        ],
      } as any,
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

  // Members may only view tasks they are assigned to or reported
  if (
    requesterRole === 'member' &&
    task.assignee_id !== requesterId &&
    task.reporter_id !== requesterId
  ) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }

  return task;
}

export async function deleteComment(
  taskId: string,
  commentId: string,
  requesterId: string,
  requesterRole: UserRole
) {
  const comment = await Comment.findOne({
    where: { id: commentId, task_id: taskId, is_deleted: false },
  });

  if (!comment) {
    const err = new Error('Comment not found');
    (err as any).status = 404;
    throw err;
  }

  if (requesterRole !== 'admin' && comment.author_id !== requesterId) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }

  await comment.update({ is_deleted: true });
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
  },
  requesterId: string,
  requesterRole: UserRole
) {
  const task = await Task.findOne({ where: { id, is_deleted: false } });
  if (!task) {
    const err = new Error('Task not found');
    (err as any).status = 404;
    throw err;
  }

  // Members may only update tasks they created
  if (requesterRole === 'member' && task.reporter_id !== requesterId) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
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

export async function patchTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    project_id?: string;
    assignee_id?: string | null;
    priority?: TaskPriority;
    due_date?: Date | null;
    status?: TaskStatus;
  },
  requesterId: string,
  requesterRole: UserRole
) {
  return updateTask(id, data, requesterId, requesterRole);
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
