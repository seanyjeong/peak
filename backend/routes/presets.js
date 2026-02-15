/**
 * Class Preset Routes (반배치 프리셋)
 * - 프리셋 CRUD
 * - 그룹 CRUD
 * - 멤버 관리
 * - 프리셋 적용 (자동 반배치)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');
const { decryptStudentFields } = require('../utils/paca-student');

// GET /peak/presets - 프리셋 목록 (그룹 + 멤버 포함)
router.get('/', async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [presets] = await db.query(
            'SELECT * FROM class_presets WHERE academy_id = ? ORDER BY created_at',
            [academyId]
        );

        // Fetch groups and members for each preset
        for (const preset of presets) {
            const [groups] = await db.query(
                'SELECT * FROM preset_groups WHERE preset_id = ? ORDER BY order_num',
                [preset.id]
            );

            for (const group of groups) {
                const [members] = await db.query(`
                    SELECT pgm.student_id, ps.name, ps.gender, ps.grade, ps.school, ps.status
                    FROM preset_group_members pgm
                    JOIN students s ON pgm.student_id = s.id
                    JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
                    WHERE pgm.group_id = ?
                    ORDER BY ps.name
                `, [academyId, group.id]);

                group.members = decryptStudentFields(members);

                // Resolve instructor name from Paca if instructor_id exists
                if (group.instructor_id) {
                    try {
                        if (group.instructor_id < 0) {
                            // Owner (negative ID)
                            const [owners] = await pacaPool.query(
                                'SELECT name FROM users WHERE id = ? AND role = "owner"',
                                [-group.instructor_id]
                            );
                            group.instructor_name = owners[0] ? decrypt(owners[0].name) : '알 수 없음';
                        } else {
                            const [instructors] = await pacaPool.query(
                                'SELECT name FROM instructors WHERE id = ?',
                                [group.instructor_id]
                            );
                            group.instructor_name = instructors[0] ? decrypt(instructors[0].name) : '알 수 없음';
                        }
                    } catch {
                        group.instructor_name = '알 수 없음';
                    }
                }
            }

            preset.groups = groups;
        }

        res.json({ success: true, presets });
    } catch (error) {
        console.error('Get presets error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// GET /peak/presets/instructors - all instructors for preset config
router.get("/instructors", async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const [instructors] = await pacaPool.query(
            "SELECT id, name FROM instructors WHERE academy_id = ? AND status = \"active\" ORDER BY name",
            [academyId]
        );
        const result = instructors.map(i => ({
            id: i.id,
            name: i.name ? decrypt(i.name) : "unknown",
            isOwner: false
        }));
        const [owners] = await pacaPool.query(
            "SELECT id, name FROM users WHERE academy_id = ? AND role = \"owner\"",
            [academyId]
        );
        owners.forEach(o => {
            result.push({ id: -o.id, name: o.name ? decrypt(o.name) : "owner", isOwner: true });
        });
        res.json({ success: true, instructors: result });
    } catch (error) {
        console.error("Get preset instructors error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /peak/presets - 프리셋 생성
router.post('/', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { name, type } = req.body;

        if (!name || !type || !['homeroom', 'group'].includes(type)) {
            return res.status(400).json({ error: 'name and type (homeroom/group) required' });
        }

        const [result] = await db.query(
            'INSERT INTO class_presets (academy_id, name, type) VALUES (?, ?, ?)',
            [academyId, name, type]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Create preset error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/presets/:id - 프리셋 수정
router.put('/:id', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { name, is_active } = req.body;

        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

        if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

        params.push(req.params.id, academyId);
        await db.query(
            `UPDATE class_presets SET ${updates.join(', ')} WHERE id = ? AND academy_id = ?`,
            params
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update preset error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/presets/:id - 프리셋 삭제 (CASCADE)
router.delete('/:id', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        await db.query(
            'DELETE FROM class_presets WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Delete preset error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/presets/:id/groups - 그룹 추가
router.post('/:id/groups', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { name, instructor_id } = req.body;

        // Verify preset belongs to academy
        const [preset] = await db.query(
            'SELECT id FROM class_presets WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );
        if (preset.length === 0) return res.status(404).json({ error: 'Preset not found' });

        // Get next order_num
        const [maxOrder] = await db.query(
            'SELECT COALESCE(MAX(order_num), -1) + 1 as next_order FROM preset_groups WHERE preset_id = ?',
            [req.params.id]
        );

        const [result] = await db.query(
            'INSERT INTO preset_groups (preset_id, name, instructor_id, order_num) VALUES (?, ?, ?, ?)',
            [req.params.id, name || '새 그룹', instructor_id || null, maxOrder[0].next_order]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /peak/presets/groups/:groupId - 그룹 수정
router.put('/groups/:groupId', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { name, instructor_id, order_num } = req.body;

        // Verify group belongs to this academy
        const [groupCheck] = await db.query(
            'SELECT pg.id FROM preset_groups pg JOIN class_presets cp ON pg.preset_id = cp.id WHERE pg.id = ? AND cp.academy_id = ?',
            [req.params.groupId, academyId]
        );
        if (groupCheck.length === 0) return res.status(404).json({ error: 'Group not found' });

        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (instructor_id !== undefined) { updates.push('instructor_id = ?'); params.push(instructor_id); }
        if (order_num !== undefined) { updates.push('order_num = ?'); params.push(order_num); }

        if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

        params.push(req.params.groupId);
        await db.query(
            `UPDATE preset_groups SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/presets/groups/:groupId - 그룹 삭제 (CASCADE)
router.delete('/groups/:groupId', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        // Verify group belongs to this academy
        const [groupCheck] = await db.query(
            'SELECT pg.id FROM preset_groups pg JOIN class_presets cp ON pg.preset_id = cp.id WHERE pg.id = ? AND cp.academy_id = ?',
            [req.params.groupId, academyId]
        );
        if (groupCheck.length === 0) return res.status(404).json({ error: 'Group not found' });

        await db.query('DELETE FROM preset_groups WHERE id = ?', [req.params.groupId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/presets/groups/:groupId/members - 학생 추가 (batch)
router.post('/groups/:groupId/members', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        // Verify group belongs to this academy
        const [groupCheck] = await db.query(
            'SELECT pg.id FROM preset_groups pg JOIN class_presets cp ON pg.preset_id = cp.id WHERE pg.id = ? AND cp.academy_id = ?',
            [req.params.groupId, academyId]
        );
        if (groupCheck.length === 0) return res.status(404).json({ error: 'Group not found' });

        const { student_ids } = req.body;
        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ error: 'student_ids array required' });
        }

        const values = student_ids.map(sid => [req.params.groupId, sid]);
        await db.query(
            'INSERT IGNORE INTO preset_group_members (group_id, student_id) VALUES ?',
            [values]
        );

        res.json({ success: true, added: student_ids.length });
    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /peak/presets/groups/:groupId/members - 학생 제거 (batch)
router.delete('/groups/:groupId/members', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        // Verify group belongs to this academy
        const [groupCheck] = await db.query(
            'SELECT pg.id FROM preset_groups pg JOIN class_presets cp ON pg.preset_id = cp.id WHERE pg.id = ? AND cp.academy_id = ?',
            [req.params.groupId, academyId]
        );
        if (groupCheck.length === 0) return res.status(404).json({ error: 'Group not found' });

        const { student_ids } = req.body;
        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ error: 'student_ids array required' });
        }

        await db.query(
            'DELETE FROM preset_group_members WHERE group_id = ? AND student_id IN (?)',
            [req.params.groupId, student_ids]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Remove members error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /peak/presets/:id/apply - 프리셋 적용 (자동 반배치)
router.post('/:id/apply', async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const { date, time_slot } = req.body;

        if (!date || !time_slot) {
            return res.status(400).json({ error: 'date and time_slot required' });
        }

        // 1. Load preset with groups and members
        const [preset] = await db.query(
            'SELECT * FROM class_presets WHERE id = ? AND academy_id = ?',
            [req.params.id, academyId]
        );
        if (preset.length === 0) return res.status(404).json({ error: 'Preset not found' });

        const [groups] = await db.query(
            'SELECT * FROM preset_groups WHERE preset_id = ? ORDER BY order_num',
            [req.params.id]
        );

        for (const group of groups) {
            const [members] = await db.query(
                'SELECT student_id FROM preset_group_members WHERE group_id = ?',
                [group.id]
            );
            group.member_ids = members.map(m => m.student_id);
        }

        // 2. Get today's available instructors from Paca
        const [pacaInstructors] = await pacaPool.query(`
            SELECT DISTINCT i.id
            FROM instructor_schedules isch
            JOIN instructors i ON isch.instructor_id = i.id
            LEFT JOIN instructor_attendance ia
                ON ia.instructor_id = isch.instructor_id
                AND ia.work_date = isch.work_date
                AND ia.time_slot = isch.time_slot
            WHERE isch.academy_id = ? AND isch.work_date = ? AND isch.time_slot = ?
        `, [academyId, date, time_slot]);
        const availableInstructorIds = new Set(pacaInstructors.map(i => i.id));

        // Also include owners (always available)
        const [owners] = await pacaPool.query(
            'SELECT id FROM users WHERE academy_id = ? AND role = "owner"',
            [academyId]
        );
        owners.forEach(o => availableInstructorIds.add(-o.id));

        // 3. Get today's students in this time slot
        const [todayStudents] = await db.query(
            'SELECT id, student_id FROM daily_assignments WHERE academy_id = ? AND date = ? AND time_slot = ?',
            [academyId, date, time_slot]
        );
        const studentAssignmentMap = {};
        todayStudents.forEach(s => {
            studentAssignmentMap[s.student_id] = s.id;
        });

        // 4. Reset current assignments for this time slot
        await db.query(
            'DELETE FROM class_instructors WHERE academy_id = ? AND date = ? AND time_slot = ?',
            [academyId, date, time_slot]
        );
        await db.query(
            'UPDATE daily_assignments SET class_id = NULL WHERE academy_id = ? AND date = ? AND time_slot = ?',
            [academyId, date, time_slot]
        );

        // 5. Apply preset groups
        let classNum = 1;
        let classesCreated = 0;
        let studentsAssigned = 0;
        let instructorsAbsent = 0;

        for (const group of groups) {
            // Check if group has any students present today
            const matchingStudentIds = group.member_ids.filter(sid => studentAssignmentMap[sid]);
            if (matchingStudentIds.length === 0 && !group.instructor_id) continue;

            // Assign instructor if available
            if (group.instructor_id) {
                if (availableInstructorIds.has(group.instructor_id)) {
                    await db.query(
                        'INSERT INTO class_instructors (academy_id, date, time_slot, class_num, instructor_id, is_main, order_num) VALUES (?, ?, ?, ?, ?, 1, 0)',
                        [academyId, date, time_slot, classNum, group.instructor_id]
                    );
                } else {
                    instructorsAbsent++;
                    // Still create class without instructor if there are students
                    if (matchingStudentIds.length === 0) continue;
                }
            }

            // Assign students
            for (const studentId of matchingStudentIds) {
                const assignmentId = studentAssignmentMap[studentId];
                if (assignmentId) {
                    await db.query(
                        'UPDATE daily_assignments SET class_id = ? WHERE id = ?',
                        [classNum, assignmentId]
                    );
                    studentsAssigned++;
                }
            }

            classesCreated++;
            classNum++;
        }

        const studentsUnmatched = todayStudents.length - studentsAssigned;

        // 6. Socket.io broadcast
        const io = req.app.get('io');
        if (io) {
            io.to(`academy-${academyId}`).emit('assignments-updated', { date, time_slot });
        }

        res.json({
            success: true,
            result: {
                classes_created: classesCreated,
                students_assigned: studentsAssigned,
                students_unmatched: studentsUnmatched,
                instructors_absent: instructorsAbsent
            }
        });
    } catch (error) {
        console.error('Apply preset error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
