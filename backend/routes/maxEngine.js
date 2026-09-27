const express = require('express');
const gateway = require('../services/maxEngineGateway');
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function forward(path) {
  return async (req, res) => {
    try {
      const upstream = typeof path === 'function' ? path(req) : path;
      const result = await gateway.request(req.method, upstream, req.headers.authorization, req.body, req.query);
      res.status(result.status).json(result.body);
    } catch {
      res.status(503).json({ error: { code: 'SOURCE_UNAVAILABLE', message: 'PACA 연동 상태를 확인해 주세요.', details: {} } });
    }
  };
}
router.post('/token', forward('/token'));
router.get('/identity', forward('/identity'));
router.get('/catalog', forward('/peak/catalog'));
router.get('/workflows/:workflow', (req, res, next) => {
  if (!['recent_records', 'event_ranking', 'student_progress'].includes(req.params.workflow)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '조회 업무를 확인해 주세요.', details: {} } });
  next();
}, forward(req => '/peak/workflows/' + req.params.workflow));
router.get('/resources/:resource', (req, res, next) => {
  if (!/^[a-z][a-z0-9_]*$/.test(req.params.resource)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '조회 항목을 확인해 주세요.', details: {} } });
  next();
}, forward(req => '/peak/resources/' + req.params.resource));
router.post('/preview', forward('/peak/preview'));
router.post('/confirm', forward('/peak/confirm'));
router.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: '허용된 연동 경로를 확인해 주세요.', details: {} } }));
module.exports = router;
