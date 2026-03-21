import { Request, Response, NextFunction } from 'express';
import * as userService from './user-service';
import { UserRole } from '../../models/user.model';

export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await userService.listUsers(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userService.getUser(
      req.params.id,
      req.user!.sub,
      req.user!.role as UserRole
    );
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await userService.updateUser(
      req.params.id,
      req.user!.sub,
      req.user!.role as UserRole,
      req.body
    );
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}
