import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  createTaskSchema,
  updateTaskSchema,
  patchTaskSchema,
  addCommentSchema,
  taskFiltersSchema,
} from './task-schemas';
import * as taskController from './task-controller';

const router = Router();

router.get('/', validate(taskFiltersSchema, 'query'), taskController.getTasks);
router.post('/', validate(createTaskSchema), taskController.createTask);
router.get('/:id', taskController.getTask);
router.put('/:id', validate(updateTaskSchema), taskController.updateTask);
router.patch('/:id', validate(patchTaskSchema), taskController.patchTask);
router.delete('/:id', taskController.deleteTask);
router.post(
  '/:id/comments',
  validate(addCommentSchema),
  taskController.addComment
);

export default router;
