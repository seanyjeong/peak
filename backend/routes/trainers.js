/**
 * Trainers Routes (P-ACA 강사 연동)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const mysql = require('mysql2/promise');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');

// P-ACA DB 연결
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

// GET /peak/trainers - P-ACA 강사 목록
router.get('/', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        // P-ACA 강사 조회 - 로그인한 사용자의 학원
        const [instructors] = await pacaPool.query(`
            SELECT i.id, i.user_id as paca_user_id, i.name, u.email
            FROM instructors i
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.academy_id = ? AND i.status = 'active' AND i.deleted_at IS NULL
            ORDER BY i.name
        `, [academyId]);

        // 이름 복호화
        const trainers = instructors.map(i => {
            let name = i.name;
            try {
                if (name && name.startsWith('ENC:')) {
                    name = decrypt(name);
                }
            } catch (e) {
                console.error('Name decryption error:', e);
            }
            return {
                id: i.id,
                paca_user_id: i.paca_user_id,
                name: name,
                email: i.email
            };
        });

        res.json({ success: true, trainers });
    } catch (error) {
        console.error('Get trainers error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/trainers/:id - 트레이너 상세
router.get('/:id', async (req, res) => {
    try {
        const [trainers] = await db.query(
            'SELECT * FROM trainers WHERE id = ?',
            [req.params.id]
        );
        if (trainers.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }
        res.json({ success: true, trainer: trainers[0] });
    } catch (error) {
        console.error('Get trainer error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/trainers - 트레이너 등록
router.post('/', async (req, res) => {
    try {
        const { paca_user_id, name, phone } = req.body;
        const [result] = await db.query(
            'INSERT INTO trainers (paca_user_id, name, phone) VALUES (?, ?, ?)',
            [paca_user_id, name, phone]
        );
        res.status(201).json({
            success: true,
            trainerId: result.insertId
        });
    } catch (error) {
        console.error('Create trainer error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
