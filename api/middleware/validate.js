const { HttpError } = require('../utils/httpError');

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      return next(new HttpError(400, 'Dados invalidos.', result.error.flatten()));
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = { validate };
