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
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 8330;

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

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ==========================================
// Database Connection
// ==========================================

const db = require('./config/database');

db.getConnection()
    .then(connection => {
        console.log('✅ P-EAK MySQL Database Connected (peak)');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL Connection Error:', err.message);
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
app.use('/peak/record-types', verifyToken, require('./routes/recordTypes'));
app.use('/peak/score-tables', verifyToken, require('./routes/scoreTable'));

// ==========================================
// Error Handler
// ==========================================

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

// ==========================================
// Start Server
// ==========================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║     P-EAK (피크) Server Started!          ║
║     Physical Excellence Achievement Keeper ║
╠═══════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  DB: peak                                 ║
║  Env: ${process.env.NODE_ENV || 'development'}                       ║
╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;
