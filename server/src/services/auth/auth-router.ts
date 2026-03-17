import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard';
import { validate } from '../../middleware/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth-schemas';
import * as authController from './auth-controller';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
// Refresh token arrives via httpOnly cookie — no body validation needed.
router.post('/refresh', authController.refresh);
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
