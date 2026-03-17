import { Request, Response, NextFunction } from 'express';
import * as projectService from './project-service';
import { UserRole } from '../../models/user.model';
import { ProjectStatus } from '../../models/project.model';

export async function listProjects(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await projectService.listProjects(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const project = await projectService.getProject(req.params.id);
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const project = await projectService.createProject(req.body, req.user!.sub);
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const project = await projectService.updateProject(
      req.params.id,
      req.user!.sub,
      req.user!.role as UserRole,
      req.body
    );
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function archiveProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const project = await projectService.archiveProject(
      req.params.id,
      req.user!.role as UserRole
    );
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}
