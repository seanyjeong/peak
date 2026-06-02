/**
 * Trainers Routes (P-ACA 강사 연동)
 * v2.0 - POST /sync, POST /sync-all 추가 (2026-04-22)
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

function decryptField(v) {
    if (v && typeof v === 'string' && v.startsWith('ENC:')) {
        try { return decrypt(v); } catch (e) { return v; }
    }
    return v;
}

/**
 * 단일 academy 의 강사를 paca → peak 로 sync
 * Returns { synced, updated, deactivated, total }
 */
async function syncAcademyTrainers(academyId) {
    const [pacaInstructors] = await pacaPool.query(`
        SELECT id, academy_id, name, phone, status
        FROM instructors
        WHERE academy_id = ? AND deleted_at IS NULL
    `, [academyId]);

    const processed = pacaInstructors.map(i => ({
        academyId: i.academy_id,
        pacaId: i.id,
        name: decryptField(i.name) || '이름없음',
        phone: decryptField(i.phone) || null,
        active: i.status === 'active' ? 1 : 0,
    }));

    // 원장(owner role) 도 trainers 에 sync — paca_user_id 음수로 박아 instructors.id 와 충돌 회피 (paca 컨벤션 정합)
    const [pacaOwners] = await pacaPool.query("SELECT id, academy_id, name, phone FROM users WHERE academy_id = ? AND role = 'owner' AND deleted_at IS NULL AND is_active = 1", [academyId]);
    pacaOwners.forEach(u => {
        processed.push({
            academyId: u.academy_id,
            pacaId: -u.id,
            name: decryptField(u.name) || '원장',
            phone: decryptField(u.phone) || null,
            active: 1,
        });
    });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let synced = 0, updated = 0, deactivated = 0;

        if (processed.length > 0) {
            const values = processed.map(p => [p.academyId, p.pacaId, p.name, p.phone, p.active]);
            const [result] = await connection.query(`
                INSERT INTO trainers (academy_id, paca_user_id, name, phone, active)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    phone = VALUES(phone),
                    active = VALUES(active),
                    updated_at = NOW()
            `, [values]);
            synced = result.affectedRows - result.changedRows;
            updated = result.changedRows;
        }

        // paca에 없는 (= deleted_at 설정되었거나 사라진) trainers는 deactivate
        const pacaIds = processed.map(p => p.pacaId);
        const deactivateSql = pacaIds.length > 0
            ? 'UPDATE trainers SET active = 0, updated_at = NOW() WHERE academy_id = ? AND active = 1 AND paca_user_id NOT IN (?)'
            : 'UPDATE trainers SET active = 0, updated_at = NOW() WHERE academy_id = ? AND active = 1';
        const deactivateParams = pacaIds.length > 0 ? [academyId, pacaIds] : [academyId];
        const [deactResult] = await connection.query(deactivateSql, deactivateParams);
        deactivated = deactResult.affectedRows || 0;

        await connection.commit();
        return { synced, updated, deactivated, total: processed.length };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

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

// POST /peak/trainers/sync - 로그인한 사용자의 학원만 sync
router.post('/sync', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        if (!academyId) {
            return res.status(400).json({ error: '학원 ID가 필요합니다.' });
        }
        const result = await syncAcademyTrainers(academyId);
        res.json({
            success: true,
            message: `동기화 완료: ${result.synced}명 추가, ${result.updated}명 업데이트, ${result.deactivated}명 비활성화`,
            ...result
        });
    } catch (error) {
        console.error('Sync trainers error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
});

// GET /peak/trainers/:id - 트레이너 상세
router.get('/:id', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const [trainers] = await db.query(
            'SELECT * FROM trainers WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
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
        const academyId = req.user.academyId;
        const { paca_user_id, name, phone } = req.body;
        const [result] = await db.query(
            'INSERT INTO trainers (academy_id, paca_user_id, name, phone) VALUES (?, ?, ?, ?)',
            [academyId, paca_user_id, name, phone]
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
module.exports.syncAcademyTrainers = syncAcademyTrainers;
