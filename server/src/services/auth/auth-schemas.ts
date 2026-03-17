import Joi from 'joi';

const passwordSchema = Joi.string()
  .min(8)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'digit')
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.name': 'Password must contain at least one {#name}',
  });

export const registerSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: passwordSchema,
  full_name: Joi.string().min(2).max(100).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: passwordSchema,
});

export const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: passwordSchema,
});

// Refresh token is now read from the httpOnly cookie; no body schema needed.
