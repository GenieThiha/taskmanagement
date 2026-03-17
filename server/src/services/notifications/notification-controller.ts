import { Request, Response, NextFunction } from 'express';
import * as notificationService from './notification-service';

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await notificationService.getNotificationsForUser(req.user!.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user!.sub
    );
    res.json({ data: notification });
  } catch (err) {
    next(err);
  }
}
