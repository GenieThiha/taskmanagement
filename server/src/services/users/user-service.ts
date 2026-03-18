import { User, UserRole } from '../../models/user.model';

export async function listUsers(filters: {
  page?: number;
  limit?: number;
  role?: UserRole;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { is_active: true };
  if (filters.role) where.role = filters.role;

  const { count, rows } = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    data: rows,
    meta: { total: count, page, limit, total_pages: Math.ceil(count / limit) },
  };
}

export async function getUser(id: string) {
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }
  return user;
}

export async function updateUser(
  id: string,
  requesterId: string,
  requesterRole: UserRole,
  data: {
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
  }
) {
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }

  const isSelf = requesterId === id;
  const isAdmin = requesterRole === 'admin';

  if (!isSelf && !isAdmin) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }

  const updateData: Partial<typeof data> = {};

  // Self can update full_name; admin can also update role and is_active
  if (data.full_name !== undefined) {
    updateData.full_name = data.full_name;
  }

  if (isAdmin) {
    if (data.role !== undefined) updateData.role = data.role;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
  }

  await user.update(updateData);
  return user;
}
