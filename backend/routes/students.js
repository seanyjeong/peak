/**
 * Students Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const mysql = require('mysql2/promise');
const { decrypt } = require('../utils/encryption');

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
 * POST /peak/students/sync
 * P-ACA에서 학생 데이터 동기화
 */
router.post('/sync', async (req, res) => {
    try {
        const { academyId } = req.body;

        if (!academyId) {
            return res.status(400).json({ error: '학원 ID가 필요합니다.' });
        }

        // P-ACA에서 해당 학원의 active 학생 목록 가져오기
        const [pacaStudents] = await pacaPool.query(`
            SELECT id, name, gender, phone, school, grade, enrollment_date, status
            FROM students
            WHERE academy_id = ? AND status IN ('active', 'paused', 'trial')
            ORDER BY name
        `, [academyId]);

        let synced = 0;
        let updated = 0;

        for (const student of pacaStudents) {
            // 이름 복호화
            let decryptedName = student.name;
            try {
                if (student.name && student.name.startsWith('ENC:')) {
                    decryptedName = decrypt(student.name);
                }
            } catch (e) {
                console.error('Name decryption error:', e);
            }

            // 전화번호 복호화
            let decryptedPhone = student.phone;
            try {
                if (student.phone && student.phone.startsWith('ENC:')) {
                    decryptedPhone = decrypt(student.phone);
                }
            } catch (e) {
                console.error('Phone decryption error:', e);
            }

            // gender 변환 (male/female -> M/F)
            const gender = student.gender === 'male' ? 'M' : 'F';

            // status 변환 (P-ACA -> P-EAK)
            let status = 'active';
            if (student.status === 'paused') status = 'inactive';

            // 이미 있는지 확인
            const [existing] = await db.query(
                'SELECT id FROM students WHERE paca_student_id = ?',
                [student.id]
            );

            if (existing.length > 0) {
                // 업데이트
                await db.query(`
                    UPDATE students SET
                        name = ?, gender = ?, phone = ?, school = ?, grade = ?, status = ?, updated_at = NOW()
                    WHERE paca_student_id = ?
                `, [decryptedName, gender, decryptedPhone, student.school, student.grade, status, student.id]);
                updated++;
            } else {
                // 새로 추가
                await db.query(`
                    INSERT INTO students (paca_student_id, name, gender, phone, school, grade, join_date, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [student.id, decryptedName, gender, decryptedPhone, student.school, student.grade, student.enrollment_date, status]);
                synced++;
            }
        }

        res.json({
            success: true,
            message: `동기화 완료: ${synced}명 추가, ${updated}명 업데이트`,
            synced,
            updated,
            total: pacaStudents.length
        });

    } catch (error) {
        console.error('Sync students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students - 학생 목록
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT * FROM students';
        const params = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        query += ' ORDER BY name';

        const [students] = await db.query(query, params);
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students/:id - 학생 상세
router.get('/:id', async (req, res) => {
    try {
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [req.params.id]
        );
        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }
        res.json({ success: true, student: students[0] });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/students/:id/records - 학생 기록 히스토리 (동적 종목)
router.get('/:id/records', async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT r.*, rt.name as record_type_name, rt.unit, rt.direction
            FROM student_records r
            JOIN record_types rt ON r.record_type_id = rt.id
            WHERE r.student_id = ?
            ORDER BY r.measured_at DESC, rt.display_order
        `, [req.params.id]);

        // 날짜별로 그룹화해서 반환
        const grouped = {};
        records.forEach(r => {
            const dateKey = r.measured_at.toISOString().split('T')[0];
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    measured_at: dateKey,
                    records: []
                };
            }
            grouped[dateKey].records.push({
                record_type_id: r.record_type_id,
                record_type_name: r.record_type_name,
                unit: r.unit,
                direction: r.direction,
                value: r.value,
                notes: r.notes
            });
        });

        res.json({
            success: true,
            records: Object.values(grouped).sort((a, b) =>
                new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
            )
        });
    } catch (error) {
        console.error('Get student records error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
