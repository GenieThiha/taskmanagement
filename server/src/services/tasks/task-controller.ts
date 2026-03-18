import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../models/user.model';
import * as taskService from './task-service';

export async function getTaskStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await taskService.getTaskStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
}

export async function getTasks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await taskService.getTasks(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const task = await taskService.createTask(req.body, req.user!.sub);
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function getTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { comment_page, comment_limit } = req.query as {
      comment_page?: number;
      comment_limit?: number;
    };
    const task = await taskService.getTask(req.params.id, comment_page, comment_limit);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const task = await taskService.updateTask(
      req.params.id,
      req.body,
      req.user!.sub,
      req.user!.role as UserRole
    );
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function patchTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const task = await taskService.patchTask(
      req.params.id,
      req.body,
      req.user!.sub,
      req.user!.role as UserRole
    );
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await taskService.deleteTask(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addComment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const comment = await taskService.addComment(
      req.params.id,
      req.user!.sub,
      req.body.body
    );
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
}
