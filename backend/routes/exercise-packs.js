/**
 * Exercise Packs Routes (운동 팩 관리 - 내보내기/가져오기)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /peak/exercise-packs - 팩 목록
router.get('/', async (req, res) => {
    try {
        const [packs] = await db.query(`
            SELECT p.*, COUNT(pi.id) as exercise_count
            FROM exercise_packs p
            LEFT JOIN exercise_pack_items pi ON p.id = pi.pack_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
        res.json({ success: true, packs });
    } catch (error) {
        console.error('Get packs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/exercise-packs/:id - 팩 상세 (운동 목록 포함)
router.get('/:id', async (req, res) => {
    try {
        const [packs] = await db.query(
            'SELECT * FROM exercise_packs WHERE id = ?',
            [req.params.id]
        );

        if (packs.length === 0) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const [exercises] = await db.query(`
            SELECT e.*, pi.display_order
            FROM exercises e
            JOIN exercise_pack_items pi ON e.id = pi.exercise_id
            WHERE pi.pack_id = ?
            ORDER BY pi.display_order, e.name
        `, [req.params.id]);

        // tags 파싱
        const parsedExercises = exercises.map(ex => ({
            ...ex,
            tags: typeof ex.tags === 'string' ? JSON.parse(ex.tags) : ex.tags
        }));

        res.json({
            success: true,
            pack: packs[0],
            exercises: parsedExercises
        });
    } catch (error) {
        console.error('Get pack error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/exercise-packs - 팩 생성 (스냅샷 저장)
router.post('/', async (req, res) => {
    try {
        const { name, description, exercise_ids = [] } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // 운동 데이터 조회해서 스냅샷 생성
        let snapshotData = null;
        if (exercise_ids.length > 0) {
            const [exercises] = await db.query(
                `SELECT id, name, tags, default_sets, default_reps, description
                 FROM exercises WHERE id IN (?)`,
                [exercise_ids]
            );

            // 태그 정보도 함께 저장
            const [tags] = await db.query('SELECT tag_id, label, color FROM exercise_tags WHERE is_active = TRUE');

            snapshotData = {
                format: 'peak-exercise-pack',
                version: '1.0',
                created_at: new Date().toISOString(),
                tags: tags,
                exercises: exercises.map((ex, idx) => ({
                    name: ex.name,
                    tags: typeof ex.tags === 'string' ? JSON.parse(ex.tags) : (ex.tags || []),
                    default_sets: ex.default_sets,
                    default_reps: ex.default_reps,
                    description: ex.description,
                    order: idx
                }))
            };
        }

        const [result] = await db.query(
            `INSERT INTO exercise_packs (name, description, author, snapshot_data)
             VALUES (?, ?, ?, ?)`,
            [name, description || null, req.user?.name || 'Unknown', JSON.stringify(snapshotData)]
        );

        const packId = result.insertId;

        // 운동 연결 (기존 참조 방식도 유지)
        if (exercise_ids.length > 0) {
            const values = exercise_ids.map((exId, idx) => [packId, exId, idx]);
            await db.query(
                'INSERT INTO exercise_pack_items (pack_id, exercise_id, display_order) VALUES ?',
                [values]
            );
        }

        res.status(201).json({
            success: true,
            packId
        });
    } catch (error) {
        console.error('Create pack error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/exercise-packs/:id - 팩 수정
router.put('/:id', async (req, res) => {
    try {
        const { name, description, exercise_ids } = req.body;
        const packId = req.params.id;

        // 팩 정보 수정
        if (name || description !== undefined) {
            const updates = [];
            const params = [];
            if (name) {
                updates.push('name = ?');
                params.push(name);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                params.push(description);
            }
            params.push(packId);
            await db.query(
                `UPDATE exercise_packs SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        // 운동 목록 업데이트
        if (exercise_ids !== undefined) {
            await db.query('DELETE FROM exercise_pack_items WHERE pack_id = ?', [packId]);
            if (exercise_ids.length > 0) {
                const values = exercise_ids.map((exId, idx) => [packId, exId, idx]);
                await db.query(
                    'INSERT INTO exercise_pack_items (pack_id, exercise_id, display_order) VALUES ?',
                    [values]
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update pack error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/exercise-packs/:id - 팩 삭제
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM exercise_packs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete pack error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /peak/exercise-packs/:id/export - 팩 내보내기 (JSON)
router.get('/:id/export', async (req, res) => {
    try {
        const [packs] = await db.query(
            'SELECT * FROM exercise_packs WHERE id = ?',
            [req.params.id]
        );

        if (packs.length === 0) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const pack = packs[0];

        // 팩에 포함된 운동 조회
        const [exercises] = await db.query(`
            SELECT e.name, e.tags, e.default_sets, e.default_reps, e.description, pi.display_order
            FROM exercises e
            JOIN exercise_pack_items pi ON e.id = pi.exercise_id
            WHERE pi.pack_id = ?
            ORDER BY pi.display_order, e.name
        `, [req.params.id]);

        // 팩에서 사용된 태그 조회
        const [tags] = await db.query(`
            SELECT DISTINCT t.*
            FROM exercise_tags t
            WHERE t.is_active = TRUE
        `);

        const exportData = {
            format: 'peak-exercise-pack',
            version: '1.0',
            exported_at: new Date().toISOString(),
            pack: {
                name: pack.name,
                description: pack.description,
                version: pack.version,
                author: pack.author
            },
            tags: tags.map(t => ({
                tag_id: t.tag_id,
                label: t.label,
                color: t.color
            })),
            exercises: exercises.map(ex => ({
                name: ex.name,
                tags: typeof ex.tags === 'string' ? JSON.parse(ex.tags) : ex.tags,
                default_sets: ex.default_sets,
                default_reps: ex.default_reps,
                description: ex.description,
                order: ex.display_order
            }))
        };

        res.json(exportData);
    } catch (error) {
        console.error('Export pack error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/exercise-packs/import - 팩 가져오기
router.post('/import', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const importData = req.body;

        // 형식 검증
        if (importData.format !== 'peak-exercise-pack') {
            return res.status(400).json({ error: 'Invalid pack format' });
        }

        await connection.beginTransaction();

        // 1. 태그 삽입 (없으면 추가)
        if (importData.tags && importData.tags.length > 0) {
            for (const tag of importData.tags) {
                await connection.query(`
                    INSERT INTO exercise_tags (tag_id, label, color)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE label = VALUES(label), color = VALUES(color)
                `, [tag.tag_id, tag.label, tag.color]);
            }
        }

        // 2. 팩 생성
        const [packResult] = await connection.query(`
            INSERT INTO exercise_packs (name, description, version, author)
            VALUES (?, ?, ?, ?)
        `, [
            importData.pack.name + ' (가져옴)',
            importData.pack.description,
            importData.pack.version,
            importData.pack.author
        ]);
        const packId = packResult.insertId;

        // 3. 운동 삽입 및 팩에 연결
        const exerciseIds = [];
        for (const ex of importData.exercises) {
            // 동일 이름의 운동이 있는지 확인
            const [existing] = await connection.query(
                'SELECT id FROM exercises WHERE name = ?',
                [ex.name]
            );

            let exerciseId;
            if (existing.length > 0) {
                exerciseId = existing[0].id;
            } else {
                const [exResult] = await connection.query(`
                    INSERT INTO exercises (name, tags, default_sets, default_reps, description)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    ex.name,
                    JSON.stringify(ex.tags || []),
                    ex.default_sets,
                    ex.default_reps,
                    ex.description
                ]);
                exerciseId = exResult.insertId;
            }
            exerciseIds.push({ id: exerciseId, order: ex.order });
        }

        // 4. 팩-운동 연결
        if (exerciseIds.length > 0) {
            const values = exerciseIds.map(item => [packId, item.id, item.order]);
            await connection.query(
                'INSERT INTO exercise_pack_items (pack_id, exercise_id, display_order) VALUES ?',
                [values]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            packId,
            message: `팩 "${importData.pack.name}"이(가) 성공적으로 가져와졌습니다.`,
            stats: {
                tags_imported: importData.tags?.length || 0,
                exercises_imported: importData.exercises?.length || 0
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Import pack error:', error);
        res.status(500).json({ error: 'Import failed: ' + error.message });
    } finally {
        connection.release();
    }
});

// POST /peak/exercise-packs/:id/apply - 팩 불러오기 (운동 목록 대체)
router.post('/:id/apply', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const packId = req.params.id;

        // 팩 조회
        const [packs] = await connection.query(
            'SELECT * FROM exercise_packs WHERE id = ?',
            [packId]
        );

        if (packs.length === 0) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const pack = packs[0];
        let snapshotData = pack.snapshot_data;

        // snapshot_data가 없으면 현재 연결된 운동으로 생성
        if (!snapshotData) {
            const [exercises] = await connection.query(`
                SELECT e.name, e.tags, e.default_sets, e.default_reps, e.description, pi.display_order
                FROM exercises e
                JOIN exercise_pack_items pi ON e.id = pi.exercise_id
                WHERE pi.pack_id = ?
                ORDER BY pi.display_order
            `, [packId]);

            const [tags] = await connection.query('SELECT tag_id, label, color FROM exercise_tags WHERE is_active = TRUE');

            snapshotData = {
                format: 'peak-exercise-pack',
                version: '1.0',
                tags: tags,
                exercises: exercises.map((ex, idx) => ({
                    name: ex.name,
                    tags: typeof ex.tags === 'string' ? JSON.parse(ex.tags) : (ex.tags || []),
                    default_sets: ex.default_sets,
                    default_reps: ex.default_reps,
                    description: ex.description,
                    order: idx
                }))
            };
        } else if (typeof snapshotData === 'string') {
            snapshotData = JSON.parse(snapshotData);
        }

        await connection.beginTransaction();

        // 1. 태그 삽입/업데이트
        if (snapshotData.tags && snapshotData.tags.length > 0) {
            for (const tag of snapshotData.tags) {
                await connection.query(`
                    INSERT INTO exercise_tags (tag_id, label, color)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE label = VALUES(label), color = VALUES(color)
                `, [tag.tag_id, tag.label, tag.color]);
            }
        }

        // 2. 기존 운동 삭제
        await connection.query('DELETE FROM exercises');

        // 3. 팩의 운동으로 대체
        for (const ex of snapshotData.exercises) {
            await connection.query(`
                INSERT INTO exercises (name, tags, default_sets, default_reps, description)
                VALUES (?, ?, ?, ?, ?)
            `, [
                ex.name,
                JSON.stringify(ex.tags || []),
                ex.default_sets,
                ex.default_reps,
                ex.description
            ]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: `"${pack.name}" 팩으로 운동 목록이 대체되었습니다.`,
            exerciseCount: snapshotData.exercises?.length || 0
        });
    } catch (error) {
        await connection.rollback();
        console.error('Apply pack error:', error);
        res.status(500).json({ error: 'Apply failed: ' + error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
