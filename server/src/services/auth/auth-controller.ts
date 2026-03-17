import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import * as authService from './auth-service';

// Shared cookie options for the httpOnly refresh token cookie.
const REFRESH_COOKIE = 'refresh_token';
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  // Path scoped to the auth prefix so the cookie is only sent to /v1/auth/*
  // and never to task/user/project endpoints.
  path: '/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

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
    const { refreshToken, ...result } = await authService.login(
      req.body.email,
      req.body.password
    );
    // Refresh token goes into an httpOnly cookie — never exposed to JavaScript.
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
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
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Refresh token cookie missing',
      });
      return;
    }
    const { refreshToken, ...tokens } = await authService.refresh(token);
    // Rotate: issue a new cookie with the new refresh token.
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
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
    // Clear the httpOnly cookie on logout.
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: 0 });
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
