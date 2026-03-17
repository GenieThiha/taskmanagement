import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard';
import { validate } from '../../middleware/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema,
} from './auth-schemas';
import * as authController from './auth-controller';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authGuard, authController.logout);
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.patch(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword
);

export default router;
