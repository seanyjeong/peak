/**
 * P-EAK JWT Authentication Middleware
 * P-ACA 토큰 검증 (P-ACA DB 연동)
 */

const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const JWT_SECRET = process.env.JWT_SECRET || 'jeong-paca-secret';
const N8N_API_KEY = process.env.N8N_API_KEY || 'paca-n8n-api-key-2024';

// P-ACA DB 연결 (users 테이블 조회용)
const pacaPool = mysql.createPool({
    host: process.env.PACA_DB_HOST || 'localhost',
    port: parseInt(process.env.PACA_DB_PORT) || 3306,
    user: process.env.PACA_DB_USER || 'paca',
    password: process.env.PACA_DB_PASSWORD || 'q141171616!',
    database: 'paca',
    waitForConnections: true,
    connectionLimit: 5,
    timezone: '+09:00'
});

/**
 * P-ACA JWT 토큰 검증
 */
const verifyToken = async (req, res, next) => {
    try {
        // N8N API Key 체크
        const apiKey = req.headers['x-api-key'];
        if (apiKey && apiKey === N8N_API_KEY) {
            req.user = {
                id: 0,
                email: 'n8n@system',
                name: 'N8N Service',
                role: 'admin',
                isServiceAccount: true
            };
            return next();
        }

        // Bearer 토큰 체크
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        // P-ACA DB에서 사용자 조회
        const [users] = await pacaPool.query(
            'SELECT id, email, name, role, academy_id, is_active, approval_status, position, instructor_id FROM users WHERE id = ? AND deleted_at IS NULL',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found'
            });
        }

        const user = users[0];

        if (!user.is_active || user.approval_status !== 'approved') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Account is not active'
            });
        }

        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            academyId: user.academy_id,
            position: user.position,
            instructorId: user.instructor_id
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        }
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * 역할 체크
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden', message: `Required role: ${roles.join(' or ')}` });
        }
        next();
    };
};

/**
 * 트레이너 전용 (강사 또는 관리자)
 */
const requireTrainer = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // owner, admin, teacher(강사) 허용
    const allowedRoles = ['owner', 'admin', 'teacher', 'staff'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Trainer access required' });
    }
    next();
};

module.exports = {
    verifyToken,
    requireRole,
    requireTrainer
};
