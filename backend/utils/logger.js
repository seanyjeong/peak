/**
 * P-EAK Winston Logger Configuration
 *
 * Log Levels:
 * - error: 에러, 예외 (DB 연결 실패, 인증 실패 등)
 * - warn: 경고 (느린 쿼리, 메모리 사용량 등)
 * - info: 정보 (API 호출, 사용자 액션 등)
 * - debug: 디버그 (쿼리 결과, 변수 값 등)
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 로그 디렉토리 설정
const logDir = path.join(__dirname, '..', 'logs');

// 로그 포맷 설정
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 콘솔 출력용 포맷 (개발 환경)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Daily Rotate File Transport 설정
const dailyRotateFileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: '%DATE%-combined.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // 14일 보관
  format: logFormat,
});

const errorRotateFileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: '%DATE%-error.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // 에러 로그는 30일 보관
  level: 'error',
  format: logFormat,
});

// 로거 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'peak' },
  transports: [
    dailyRotateFileTransport,
    errorRotateFileTransport,
  ],
});

// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// 편의 메서드 추가
logger.api = (method, path, status, duration, meta = {}) => {
  logger.info('API Request', {
    method,
    path,
    status,
    duration: `${duration}ms`,
    ...meta,
  });
};

logger.db = (action, table, duration, meta = {}) => {
  const level = duration > 1000 ? 'warn' : 'debug';
  logger[level]('Database Query', {
    action,
    table,
    duration: `${duration}ms`,
    ...meta,
  });
};

logger.auth = (action, userId, success, meta = {}) => {
  const level = success ? 'info' : 'warn';
  logger[level]('Authentication', {
    action,
    userId,
    success,
    ...meta,
  });
};

module.exports = logger;
