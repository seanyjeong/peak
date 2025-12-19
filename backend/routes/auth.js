/**
 * P-EAK Auth Routes
 * P-ACA 인증 연동
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { decrypt } = require('../utils/encryption');

const JWT_SECRET = process.env.JWT_SECRET || 'jeong-paca-secret';

// P-ACA DB 연결
const pacaPool = mysql.createPool({
    host: process.env.PACA_DB_HOST || 'localhost',
    user: process.env.PACA_DB_USER || 'paca',
    password: process.env.PACA_DB_PASSWORD || 'q141171616!',
    database: 'paca',
    waitForConnections: true,
    connectionLimit: 5
});

/**
 * POST /maxt/auth/login
 * P-ACA 계정으로 로그인
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이메일과 비밀번호를 입력하세요.'
            });
        }

        // P-ACA DB에서 사용자 조회
        const [users] = await pacaPool.query(
            'SELECT id, email, password_hash, name, role, academy_id, is_active, approval_status, position, instructor_id FROM users WHERE email = ? AND deleted_at IS NULL',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        const user = users[0];

        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 계정 상태 확인
        if (!user.is_active) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '비활성화된 계정입니다.'
            });
        }

        if (user.approval_status !== 'approved') {
            return res.status(403).json({
                error: 'Forbidden',
                message: '승인 대기 중인 계정입니다.'
            });
        }

        // JWT 토큰 생성
        const token = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: decrypt(user.name), // P-ACA 암호화된 이름 복호화
                role: user.role,
                academyId: user.academy_id,
                position: user.position,
                instructorId: user.instructor_id
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: '로그인 처리 중 오류가 발생했습니다.'
        });
    }
});

/**
 * GET /maxt/auth/me
 * 현재 로그인 사용자 정보
 */
router.get('/me', require('../middleware/auth').verifyToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;
