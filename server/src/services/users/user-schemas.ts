import Joi from 'joi';

export const updateUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional(),
  role: Joi.string().valid('admin', 'manager', 'member').optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

export const userListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid('admin', 'manager', 'member').optional(),
});
