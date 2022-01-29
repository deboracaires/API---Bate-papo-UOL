import Joi from 'joi';

const messageSchemma = Joi.object({
    to: Joi.string().min(1).required(),
    text: Joi.string().min(1).required(),
    type: Joi.required(),
});

export default messageSchemma;