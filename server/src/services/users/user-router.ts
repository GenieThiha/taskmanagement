import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/require-role';
import { updateUserSchema, userListSchema } from './user-schemas';
import * as userController from './user-controller';

const router = Router();

router.get(
  '/',
  requireRole('admin'),
  validate(userListSchema, 'query'),
  userController.listUsers
);
router.get('/:id', userController.getUser);
router.patch('/:id', validate(updateUserSchema), userController.updateUser);

export default router;
