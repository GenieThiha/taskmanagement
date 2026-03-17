import { Request, Response, NextFunction } from 'express';
import * as authService from './auth-service';

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refresh_token);
    res.json({ data: tokens });
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7) ?? '';
    await authService.logout(token, req.user!.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.forgotPassword(req.body.email);
    res.json({ data: { message: 'If that email exists, a reset link has been sent.' } });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ data: { message: 'Password reset successful.' } });
  } catch (err) {
    next(err);
  }
}
