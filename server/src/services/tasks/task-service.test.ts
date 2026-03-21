/**
 * task-service.test.ts
 * Unit tests for the task-service functions.
 * All Sequelize models and the notification service are mocked.
 */

process.env.NODE_ENV = 'test';

// ---- Mock: Task model ---------------------------------------------------
jest.mock('../../models/task.model', () => ({
  Task: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
  TaskStatus: {},
  TaskPriority: {},
}));

// ---- Mock: Comment model -----------------------------------------------
jest.mock('../../models/comment.model', () => ({
  Comment: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

// ---- Mock: Project model -----------------------------------------------
jest.mock('../../models/project.model', () => ({
  Project: {
    findByPk: jest.fn(),
  },
}));

// ---- Mock: User model --------------------------------------------------
jest.mock('../../models/user.model', () => ({
  User: {},
  UserRole: {},
}));

// ---- Mock: notification service ----------------------------------------
jest.mock('../notifications/notification-service', () => ({
  notify: jest.fn().mockResolvedValue(undefined),
}));

// ---- Mock: logger -------------------------------------------------------
jest.mock('../../logger/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---- Mock: p-limit (no real concurrency needed in tests) ---------------
jest.mock('p-limit', () => () => (fn: () => unknown) => fn());

import { Task } from '../../models/task.model';
import { Comment } from '../../models/comment.model';
import { Project } from '../../models/project.model';
import { notify } from '../notifications/notification-service';
import * as taskService from './task-service';

const MockTask = Task as jest.Mocked<typeof Task>;
const MockComment = Comment as jest.Mocked<typeof Comment>;
const MockProject = Project as jest.Mocked<typeof Project>;
const mockNotify = notify as jest.MockedFunction<typeof notify>;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Test task',
    assignee_id: 'user-2',
    reporter_id: 'user-1',
    status: 'todo',
    priority: 'medium',
    is_deleted: false,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    task_id: 'task-1',
    author_id: 'user-1',
    body: 'A comment',
    is_deleted: false,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getTasks()
// ---------------------------------------------------------------------------
describe('taskService.getTasks', () => {
  beforeEach(() => {
    MockTask.findAndCountAll.mockResolvedValue({ count: 0, rows: [] } as any);
  });

  it('passes an OR filter for assignee_id and reporter_id when the requester is a member', async () => {
    await taskService.getTasks({}, 'user-1', 'member');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    // Sequelize Op.or is a Symbol, so Object.keys() won't see it.
    // Use Reflect.ownKeys to include Symbol keys and verify the restriction exists.
    const allKeys = Reflect.ownKeys(callArgs.where);
    expect(allKeys.length).toBeGreaterThan(1);
  });

  it('does not add an OR filter for managers (sees all tasks)', async () => {
    await taskService.getTasks({}, 'user-1', 'manager');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    // Only is_deleted should be in the base where clause.
    expect(Object.keys(callArgs.where)).toEqual(['is_deleted']);
  });

  it('does not add an OR filter for admins (sees all tasks)', async () => {
    await taskService.getTasks({}, 'user-1', 'admin');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    expect(Object.keys(callArgs.where)).toEqual(['is_deleted']);
  });

  it('applies project_id filter when provided', async () => {
    await taskService.getTasks({ project_id: 'proj-1' }, 'user-1', 'admin');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.project_id).toBe('proj-1');
  });

  it('applies status filter when provided', async () => {
    await taskService.getTasks({ status: 'done' }, 'user-1', 'admin');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.status).toBe('done');
  });

  it('applies priority filter when provided', async () => {
    await taskService.getTasks({ priority: 'high' }, 'user-1', 'admin');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.priority).toBe('high');
  });

  it('returns pagination meta with correct total_pages', async () => {
    MockTask.findAndCountAll.mockResolvedValue({ count: 45, rows: [] } as any);

    const result = await taskService.getTasks({ page: 1, limit: 20 }, 'user-1', 'admin');

    expect(result.meta.total).toBe(45);
    expect(result.meta.total_pages).toBe(3);
  });

  it('defaults to page 1 and limit 20', async () => {
    await taskService.getTasks({}, 'user-1', 'admin');

    const callArgs = (MockTask.findAndCountAll as jest.Mock).mock.calls[0][0];
    expect(callArgs.limit).toBe(20);
    expect(callArgs.offset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTask()
// ---------------------------------------------------------------------------
describe('taskService.getTask', () => {
  it('returns the task when a manager requests it', async () => {
    const task = makeTask({ assignee_id: 'other-user', reporter_id: 'yet-another' });
    MockTask.findOne.mockResolvedValue(task as any);

    const result = await taskService.getTask('task-1', 'manager-id', 'manager');
    expect(result).toBe(task);
  });

  it('allows a member to view a task they are assigned to', async () => {
    const task = makeTask({ assignee_id: 'member-1', reporter_id: 'someone-else' });
    MockTask.findOne.mockResolvedValue(task as any);

    const result = await taskService.getTask('task-1', 'member-1', 'member');
    expect(result).toBe(task);
  });

  it('allows a member to view a task they reported', async () => {
    const task = makeTask({ assignee_id: 'other', reporter_id: 'member-1' });
    MockTask.findOne.mockResolvedValue(task as any);

    const result = await taskService.getTask('task-1', 'member-1', 'member');
    expect(result).toBe(task);
  });

  it('throws 403 when a member tries to view a task they neither own nor reported', async () => {
    const task = makeTask({ assignee_id: 'other-1', reporter_id: 'other-2' });
    MockTask.findOne.mockResolvedValue(task as any);

    await expect(taskService.getTask('task-1', 'member-1', 'member')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('throws 404 when the task does not exist', async () => {
    MockTask.findOne.mockResolvedValue(null);

    await expect(taskService.getTask('no-such-task', 'user-1', 'admin')).rejects.toMatchObject({
      status: 404,
      message: 'Task not found',
    });
  });
});

// ---------------------------------------------------------------------------
// createTask()
// ---------------------------------------------------------------------------
describe('taskService.createTask', () => {
  const TASK_DATA = {
    title: 'New task',
    project_id: 'proj-1',
    assignee_id: 'user-2',
  };

  beforeEach(() => {
    MockTask.create.mockResolvedValue(makeTask() as any);
  });

  it('creates and returns a task for an active project', async () => {
    MockProject.findByPk.mockResolvedValue({ id: 'proj-1', status: 'active' } as any);

    const result = await taskService.createTask(TASK_DATA, 'reporter-1');

    expect(MockTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New task', reporter_id: 'reporter-1' })
    );
    expect(result).toBeDefined();
  });

  it('sends a task_assigned notification when assignee_id is provided', async () => {
    MockProject.findByPk.mockResolvedValue({ id: 'proj-1', status: 'active' } as any);

    await taskService.createTask(TASK_DATA, 'reporter-1');

    // notify is called asynchronously; give event loop a tick
    await Promise.resolve();
    expect(mockNotify).toHaveBeenCalledWith(
      'task_assigned',
      expect.any(String),
      'task',
      ['user-2'],
      expect.stringContaining('New task')
    );
  });

  it('does not send a notification when no assignee_id is provided', async () => {
    MockProject.findByPk.mockResolvedValue({ id: 'proj-1', status: 'active' } as any);
    MockTask.create.mockResolvedValue(makeTask({ assignee_id: null }) as any);

    await taskService.createTask({ title: 'Unassigned', project_id: 'proj-1' }, 'reporter-1');
    await Promise.resolve();

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('throws 404 when the project does not exist', async () => {
    MockProject.findByPk.mockResolvedValue(null);

    await expect(taskService.createTask(TASK_DATA, 'reporter-1')).rejects.toMatchObject({
      status: 404,
      message: 'Project not found',
    });
  });

  it('throws 400 when trying to create a task in an archived project', async () => {
    MockProject.findByPk.mockResolvedValue({ id: 'proj-1', status: 'archived' } as any);

    await expect(taskService.createTask(TASK_DATA, 'reporter-1')).rejects.toMatchObject({
      status: 400,
      message: 'Cannot create tasks in an archived project',
    });
  });
});

// ---------------------------------------------------------------------------
// updateTask()
// ---------------------------------------------------------------------------
describe('taskService.updateTask', () => {
  it('allows a member to update a task they reported', async () => {
    const task = makeTask({ reporter_id: 'member-1' });
    MockTask.findOne.mockResolvedValue(task as any);

    await taskService.updateTask('task-1', { title: 'Updated' }, 'member-1', 'member');

    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated' }));
  });

  it('throws 403 when a member tries to update a task they did not report', async () => {
    const task = makeTask({ reporter_id: 'someone-else' });
    MockTask.findOne.mockResolvedValue(task as any);

    await expect(
      taskService.updateTask('task-1', { title: 'Hack' }, 'member-1', 'member')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows a manager to update any task', async () => {
    const task = makeTask({ reporter_id: 'another-user' });
    MockTask.findOne.mockResolvedValue(task as any);

    await taskService.updateTask('task-1', { status: 'done' }, 'manager-1', 'manager');

    expect(task.update).toHaveBeenCalled();
  });

  it('throws 404 when the task does not exist', async () => {
    MockTask.findOne.mockResolvedValue(null);

    await expect(
      taskService.updateTask('bad-id', {}, 'user-1', 'admin')
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// deleteComment()
// ---------------------------------------------------------------------------
describe('taskService.deleteComment', () => {
  it('allows the comment author to delete their own comment', async () => {
    const comment = makeComment({ author_id: 'user-1' });
    MockComment.findOne.mockResolvedValue(comment as any);

    await taskService.deleteComment('task-1', 'comment-1', 'user-1', 'member');

    expect(comment.update).toHaveBeenCalledWith({ is_deleted: true });
  });

  it('allows an admin to delete any comment regardless of authorship', async () => {
    const comment = makeComment({ author_id: 'another-user' });
    MockComment.findOne.mockResolvedValue(comment as any);

    await taskService.deleteComment('task-1', 'comment-1', 'admin-1', 'admin');

    expect(comment.update).toHaveBeenCalledWith({ is_deleted: true });
  });

  it('throws 403 when a non-author non-admin tries to delete a comment', async () => {
    const comment = makeComment({ author_id: 'owner-user' });
    MockComment.findOne.mockResolvedValue(comment as any);

    await expect(
      taskService.deleteComment('task-1', 'comment-1', 'intruder', 'member')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('throws 404 when the comment does not exist', async () => {
    MockComment.findOne.mockResolvedValue(null);

    await expect(
      taskService.deleteComment('task-1', 'no-comment', 'user-1', 'admin')
    ).rejects.toMatchObject({ status: 404, message: 'Comment not found' });
  });
});
