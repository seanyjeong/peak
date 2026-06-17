const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

function registerAssignmentInstructorRoutes(router) {
    router.post('/instructor', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academyId;
            const { date, time_slot, instructor_id, to_class_num, is_main } = req.body;
            const targetDate = date || new Date().toISOString().split('T')[0];

            if (to_class_num === null || to_class_num === undefined) {
                const [deleted] = await db.query(`
                    DELETE FROM class_instructors
                    WHERE academy_id = ? AND date = ? AND time_slot = ? AND instructor_id = ?
                `, [academyId, targetDate, time_slot, instructor_id]);

                if (deleted.affectedRows > 0) {
                    await cleanupEmptyClasses(targetDate, time_slot, academyId);
                }

                const io = req.app.get('io');
                if (io) {
                    io.to(`academy-${academyId}`).emit('assignments-updated', {
                        date: targetDate,
                        time_slot,
                        action: 'instructor-removed',
                    });
                }

                return res.json({ success: true, action: 'removed' });
            }

            await db.query(`
                DELETE FROM class_instructors
                WHERE academy_id = ? AND date = ? AND time_slot = ? AND instructor_id = ?
            `, [academyId, targetDate, time_slot, instructor_id]);

            const [existingInsts] = await db.query(`
                SELECT * FROM class_instructors
                WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_num = ?
                ORDER BY order_num
            `, [academyId, targetDate, time_slot, to_class_num]);

            let orderNum = 0;
            const isMainFlag = is_main !== undefined ? is_main : (existingInsts.length === 0);

            if (isMainFlag && existingInsts.length > 0) {
                await db.query(`
                    UPDATE class_instructors
                    SET is_main = 0, order_num = order_num + 1
                    WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_num = ? AND is_main = 1
                `, [academyId, targetDate, time_slot, to_class_num]);
            } else {
                orderNum = existingInsts.length;
            }

            await db.query(`
                INSERT INTO class_instructors (academy_id, date, time_slot, class_num, instructor_id, is_main, order_num)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [academyId, targetDate, time_slot, to_class_num, instructor_id, isMainFlag ? 1 : 0, orderNum]);

            await cleanupEmptyClasses(targetDate, time_slot, academyId);

            const io = req.app.get('io');
            if (io) {
                io.to(`academy-${academyId}`).emit('assignments-updated', {
                    date: targetDate,
                    time_slot,
                    action: 'instructor-assigned',
                    class_num: to_class_num,
                });
            }

            res.json({ success: true, action: 'assigned', class_num: to_class_num });
        } catch (error) {
            console.error('Instructor assignment error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}

async function cleanupEmptyClasses(date, timeSlot, academyId) {
    const [classesWithInstructors] = await db.query(`
        SELECT DISTINCT class_num FROM class_instructors
        WHERE academy_id = ? AND date = ? AND time_slot = ?
    `, [academyId, date, timeSlot]);

    const validClassNums = classesWithInstructors.map(c => c.class_num);

    if (validClassNums.length === 0) {
        await db.query(`
            UPDATE daily_assignments
            SET class_id = NULL
            WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_id IS NOT NULL
        `, [academyId, date, timeSlot]);
        return;
    }

    await db.query(`
        UPDATE daily_assignments
        SET class_id = NULL
        WHERE academy_id = ? AND date = ? AND time_slot = ? AND class_id IS NOT NULL AND class_id NOT IN (?)
    `, [academyId, date, timeSlot, validClassNums]);
}

module.exports = registerAssignmentInstructorRoutes;
