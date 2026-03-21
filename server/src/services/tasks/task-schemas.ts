import Joi from 'joi';

export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(10000).optional().allow('', null),
  project_id: Joi.string().uuid().required(),
  assignee_id: Joi.string().uuid().optional().allow(null),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'critical')
    .default('medium'),
  due_date: Joi.date().iso().min('now').optional().allow(null),
  status: Joi.string()
    .valid('todo', 'in_progress', 'review', 'done')
    .default('todo'),
});

export const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(10000).optional().allow('', null),
  project_id: Joi.string().uuid().required(),
  assignee_id: Joi.string().uuid().optional().allow(null),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  due_date: Joi.date().iso().min('now').optional().allow(null),
  status: Joi.string()
    .valid('todo', 'in_progress', 'review', 'done')
    .required(),
});

export const patchTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(10000).optional().allow('', null),
  project_id: Joi.string().uuid().optional(),
  assignee_id: Joi.string().uuid().optional().allow(null),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'critical')
    .optional(),
  due_date: Joi.date().iso().min('now').optional().allow(null),
  status: Joi.string()
    .valid('todo', 'in_progress', 'review', 'done')
    .optional(),
}).min(1);

export const addCommentSchema = Joi.object({
  body: Joi.string().min(1).max(2000).required(),
});

export const getTaskQuerySchema = Joi.object({
  comment_page: Joi.number().integer().min(1).default(1),
  comment_limit: Joi.number().integer().min(1).max(100).default(20),
});

export const taskFiltersSchema = Joi.object({
  project_id: Joi.string().uuid().optional(),
  assignee_id: Joi.string().uuid().optional(),
  status: Joi.string()
    .valid('todo', 'in_progress', 'review', 'done')
    .optional(),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'critical')
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
