/**
 * Request Logger Middleware
 * Winston을 사용한 HTTP 요청 로깅
 */

const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // 원래 end 메서드 저장
  const originalEnd = res.end;

  // end 메서드 오버라이드
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    // 정적 리소스 제외 (옵션)
    const skipPaths = ['/health', '/favicon.ico'];
    if (!skipPaths.includes(req.path)) {
      logger.api(
        req.method,
        req.path,
        status,
        duration,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 100),
          userId: req.user?.id,
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
        }
      );

      // 느린 요청 경고
      if (duration > 3000) {
        logger.warn('Slow Request Detected', {
          method: req.method,
          path: req.path,
          duration: `${duration}ms`,
        });
      }
    }

    // 원래 end 메서드 호출
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLogger;
