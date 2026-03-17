import Joi from 'joi';

export const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(2000).optional().allow('', null),
});

export const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(2000).optional().allow('', null),
  status: Joi.string().valid('active', 'completed').optional(), // archived only via DELETE
}).min(1);

export const projectListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('active', 'archived', 'completed').optional(),
});
