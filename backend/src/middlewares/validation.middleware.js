import { ValidationError } from '../utils/errors.js';

export const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Replace original data with parsed/sanitized data
        req.body = parsed.body;
        req.query = parsed.query;
        req.params = parsed.params;

        next();
    } catch (error) {
        const details = error.errors ? error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
        })) : [{ message: error.message }];
        next(new ValidationError('Validation failed', details));
    }
};
