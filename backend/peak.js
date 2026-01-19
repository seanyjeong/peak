/**
 * P-EAK 체육 실기 훈련 관리 시스템 Backend Server
 * Port: 8330
 * Database: MySQL (peak)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Winston Logger 및 Request Logger
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8330;

// Socket.io 설정
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Socket.io를 app에 저장 (라우터에서 사용)
app.set('io', io);

// Socket.io 연결 핸들링
io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id });

    // 학원 room 참가 (토큰 검증)
    socket.on('join-academy', (token) => {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const academyId = decoded.academyId;
            socket.join(`academy-${academyId}`);
            socket.academyId = academyId;
            logger.info('Socket joined academy room', { socketId: socket.id, academyId });
            socket.emit('joined', { academyId });
        } catch (err) {
            logger.warn('Socket auth failed', { socketId: socket.id, error: err.message });
            socket.emit('error', { message: 'Authentication failed' });
        }
    });

    socket.on('disconnect', () => {
        logger.info('Socket disconnected', { socketId: socket.id, academyId: socket.academyId });
    });
});

app.set('trust proxy', 1);

// ==========================================
// Middleware
// ==========================================

app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
    optionsSuccessStatus: 200
}));

app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Winston Request Logger
app.use(requestLogger);

// ==========================================
// Database Connection
// ==========================================

const db = require('./config/database');

db.getConnection()
    .then(connection => {
        logger.info('Database connected', { database: 'peak' });
        connection.release();
    })
    .catch(err => {
        logger.error('Database connection failed', { error: err.message });
        process.exit(1);
    });

// ==========================================
// Routes
// ==========================================

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'P-EAK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
const { verifyToken } = require('./middleware/auth');

// 인증 라우트 (P-ACA 연동)
app.use('/peak/auth', require('./routes/auth'));

// 보호된 라우트들
app.use('/peak/trainers', verifyToken, require('./routes/trainers'));
app.use('/peak/students', verifyToken, require('./routes/students'));
app.use('/peak/plans', verifyToken, require('./routes/plans'));
app.use('/peak/assignments', verifyToken, require('./routes/assignments'));
app.use('/peak/training', verifyToken, require('./routes/training'));
app.use('/peak/records', verifyToken, require('./routes/records'));
app.use('/peak/attendance', verifyToken, require('./routes/attendance'));
app.use('/peak/exercises', verifyToken, require('./routes/exercises'));
app.use('/peak/exercise-tags', verifyToken, require('./routes/exercise-tags'));
app.use('/peak/exercise-packs', verifyToken, require('./routes/exercise-packs'));
app.use('/peak/record-types', verifyToken, require('./routes/recordTypes'));
app.use('/peak/score-tables', verifyToken, require('./routes/scoreTable'));
app.use('/peak/stats', verifyToken, require('./routes/stats'));
app.use('/peak/settings', verifyToken, require('./routes/peakSettings'));

// 월말테스트
app.use('/peak/monthly-tests', verifyToken, require('./routes/monthlyTests'));
app.use('/peak/test-sessions', verifyToken, require('./routes/testSessions'));
app.use('/peak/test-applicants', verifyToken, require('./routes/testApplicants'));

// 전광판 (공개 API - 인증 불필요)
app.use('/peak/public', require('./routes/publicBoard'));

// 푸시 알림 및 인앱 알림
app.use('/peak/push', require('./routes/push'));
app.use('/peak/notifications', verifyToken, require('./routes/notifications'));

// ==========================================
// Error Handler
// ==========================================

app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
    });
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 Handler
app.use((req, res) => {
    logger.warn('Route not found', {
        method: req.method,
        path: req.path,
    });
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

// ==========================================
// Start Server
// ==========================================

// ==========================================
// Push Notification Scheduler
// ==========================================

const { initScheduler } = require('./scheduler/pushScheduler');

server.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        database: 'peak',
        env: process.env.NODE_ENV || 'development',
        socketio: true,
    });

    // 콘솔에도 시각적 표시
    console.log(`
╔═══════════════════════════════════════════╗
║     P-EAK (피크) Server Started!          ║
║     Physical Excellence Achievement Keeper ║
╠═══════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  DB: peak                                 ║
║  Socket.io: enabled                       ║
║  Env: ${process.env.NODE_ENV || 'development'}                       ║
╚═══════════════════════════════════════════╝
    `);

    // 스케줄러 초기화
    initScheduler();
});

module.exports = app;
