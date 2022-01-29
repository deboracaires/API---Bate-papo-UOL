import Joi from 'joi';

const participantSchemma = Joi.object({
    name: Joi.string().min(1).required(),
});

export default participantSchemma;