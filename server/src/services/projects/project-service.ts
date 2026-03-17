import { Project, ProjectStatus } from '../../models/project.model';
import { User, UserRole } from '../../models/user.model';

export async function listProjects(filters: {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;

  const { count, rows } = await Project.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'full_name', 'email'] }],
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    data: rows,
    meta: { total: count, page, limit, total_pages: Math.ceil(count / limit) },
  };
}

export async function getProject(id: string) {
  const project = await Project.findByPk(id, {
    include: [{ model: User, as: 'owner', attributes: ['id', 'full_name', 'email'] }],
  });
  if (!project) {
    const err = new Error('Project not found');
    (err as any).status = 404;
    throw err;
  }
  return project;
}

export async function createProject(
  data: { name: string; description?: string | null },
  ownerId: string
) {
  return Project.create({ ...data, owner_id: ownerId });
}

export async function updateProject(
  id: string,
  requesterId: string,
  requesterRole: UserRole,
  data: { name?: string; description?: string | null; status?: ProjectStatus }
) {
  const project = await Project.findByPk(id);
  if (!project) {
    const err = new Error('Project not found');
    (err as any).status = 404;
    throw err;
  }

  const isOwner = project.owner_id === requesterId;
  const isAdmin = requesterRole === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }

  if (data.status === 'archived') {
    const err = new Error('Use DELETE to archive a project');
    (err as any).status = 400;
    throw err;
  }

  await project.update(data);
  return project;
}

export async function archiveProject(
  id: string,
  requesterRole: UserRole
) {
  if (requesterRole !== 'admin') {
    const err = new Error('Only admins can archive projects');
    (err as any).status = 403;
    throw err;
  }

  const project = await Project.findByPk(id);
  if (!project) {
    const err = new Error('Project not found');
    (err as any).status = 404;
    throw err;
  }

  await project.update({ status: 'archived' });
  return project;
}
