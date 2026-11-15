function isIntegration(req) { return req.path.startsWith('/peak/integrations/max-engine/full'); }
function errorHandler(error, req, res, next) {
  if (!isIntegration(req)) return next(error);
  res.status(error.status === 413 ? 413 : 400).json({ error: {
    code: 'INVALID_REQUEST', message: '연동 요청 형식 또는 크기를 확인해 주세요.', details: {},
  } });
}
module.exports = { isIntegration, errorHandler };
