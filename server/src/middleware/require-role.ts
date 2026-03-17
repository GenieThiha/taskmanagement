import { Request, Response, NextFunction } from 'express';

type Role = 'admin' | 'manager' | 'member';

const roleHierarchy: Record<Role, number> = {
  admin: 3,
  manager: 2,
  member: 1,
};

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role as Role;
    const hasRole = roles.some(
      (role) => roleHierarchy[userRole] >= roleHierarchy[role]
    );

    if (!hasRole) {
      res.status(403).json({
        type: 'https://httpstatuses.com/403',
        title: 'Forbidden',
        status: 403,
        detail: `Requires one of the following roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
