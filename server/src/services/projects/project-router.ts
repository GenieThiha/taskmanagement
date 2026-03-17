import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/require-role';
import {
  createProjectSchema,
  updateProjectSchema,
  projectListSchema,
} from './project-schemas';
import * as projectController from './project-controller';

const router = Router();

router.get(
  '/',
  validate(projectListSchema, 'query'),
  projectController.listProjects
);
router.get('/:id', projectController.getProject);
router.post(
  '/',
  requireRole('manager'),
  validate(createProjectSchema),
  projectController.createProject
);
router.put(
  '/:id',
  validate(updateProjectSchema),
  projectController.updateProject
);
router.patch(
  '/:id',
  validate(updateProjectSchema),
  projectController.updateProject
);
router.delete('/:id', requireRole('admin'), projectController.archiveProject);

export default router;
