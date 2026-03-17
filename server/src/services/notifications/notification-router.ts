import { Router } from 'express';
import * as notificationController from './notification-controller';

const router = Router();

router.get('/', notificationController.getNotifications);
router.patch('/:id', notificationController.markAsRead);

export default router;
