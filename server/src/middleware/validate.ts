import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: Joi.Schema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(422).json({
        type: 'https://httpstatuses.com/422',
        title: 'Validation Error',
        status: 422,
        detail: 'Request validation failed',
        errors: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
      return;
    }

    req[target] = value;
    next();
  };
}
