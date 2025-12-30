const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

/**
 * GET /peak/notifications
 * 미읽은 알림 조회
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const [notifications] = await pool.query(
            `SELECT id, type, title, message, data, is_read, created_at
             FROM notifications
             WHERE user_id = ? AND is_read = FALSE
             ORDER BY created_at DESC
             LIMIT 10`,
            [req.user.id]
        );

        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch notifications' });
    }
});

/**
 * PUT /peak/notifications/:id/read
 * 알림 읽음 처리
 */
router.put('/:id/read', verifyToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to mark notification as read' });
    }
});

/**
 * PUT /peak/notifications/read-all
 * 모든 알림 읽음 처리
 */
router.put('/read-all', verifyToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to mark all notifications as read' });
    }
});

/**
 * GET /peak/notifications/check
 * 실시간 체크 - 기록 미입력, 수업계획 미제출
 * 앱 로드 시 호출하여 팝업 표시에 사용
 */
router.get('/check', verifyToken, async (req, res) => {
    try {
        const alerts = [];
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=일, 1=월, ...
        const academyId = req.user.academyId;

        // 1. 기록 미입력 체크 (최근 7일간 기록이 없는 학생)
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

        // 현재 주차 계산 (월 기준 N주차)
        const weekOfMonth = Math.ceil(today.getDate() / 7);
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const currentMonth = monthNames[today.getMonth()];

        // 재원생 중 최근 7일 기록 없는 학생 수 (체험생 제외) - academy_id 필터 추가
        const [studentsWithoutRecords] = await pool.query(`
            SELECT COUNT(DISTINCT s.id) as count
            FROM students s
            WHERE s.academy_id = ?
            AND s.status = 'active'
            AND (s.is_trial = FALSE OR s.is_trial IS NULL)
            AND s.id NOT IN (
                SELECT DISTINCT sr.student_id
                FROM student_records sr
                WHERE sr.academy_id = ? AND sr.measured_at >= ?
            )
        `, [academyId, academyId, weekAgoStr]);

        if (studentsWithoutRecords[0].count > 0) {
            alerts.push({
                type: 'record_missing',
                title: '실기기록 미입력',
                message: `${currentMonth} ${weekOfMonth}주차 실기기록측정이 이루어지지 않은 학생이 ${studentsWithoutRecords[0].count}명 있습니다.`,
                severity: 'warning',
                count: studentsWithoutRecords[0].count
            });
        }

        // 2. 수업계획 미제출 체크 (내일 수업인데 계획 없음)
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowFormatted = `${tomorrow.getMonth() + 1}.${String(tomorrow.getDate()).padStart(2, '0')}`;

        // 내일 출근 예정인 강사 중 계획 미제출자 (P-ACA 스케줄 기반)
        // 단순화: 본인의 내일 수업 계획 체크 - academy_id 필터 추가
        const [myPlans] = await pool.query(`
            SELECT COUNT(*) as count FROM daily_plans
            WHERE academy_id = ? AND date = ? AND instructor_id = ?
        `, [academyId, tomorrowStr, req.user.id]);

        // 내일 스케줄이 있는지 체크 (P-ACA instructor_schedules)
        // 여기서는 간단히 계획이 없으면 알림
        if (myPlans[0].count === 0) {
            // 내일이 주말이 아닌 경우에만
            const tomorrowDay = tomorrow.getDay();
            if (tomorrowDay !== 0 && tomorrowDay !== 6) { // 일요일, 토요일 제외
                alerts.push({
                    type: 'plan_missing',
                    title: '수업계획 미제출',
                    message: `${tomorrowFormatted}일 수업계획이 작성되지 않았습니다.`,
                    severity: 'info',
                    date: tomorrowStr
                });
            }
        }

        res.json({
            alerts,
            hasAlerts: alerts.length > 0
        });
    } catch (error) {
        console.error('Error checking notifications:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to check notifications' });
    }
});

/**
 * 알림 생성 유틸리티 함수
 */
async function createNotification(userId, type, title, message, data = null) {
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`,
            [userId, type, title, message, data ? JSON.stringify(data) : null]
        );
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

/**
 * 특정 학원의 모든 강사에게 알림 생성 (스케줄러에서 사용)
 * @param {number} academyId - 학원 ID (필수)
 */
async function createNotificationForAllInstructors(academyId, type, title, message, data = null) {
    if (!academyId) {
        console.error('[Notification] academyId is required');
        return 0;
    }

    try {
        // 해당 학원의 구독자에게만 알림 생성 (P-ACA users 테이블 조인)
        const pacaPool = require('../config/paca-database');
        const [users] = await pacaPool.query(
            `SELECT DISTINCT ps.user_id
             FROM peak.push_subscriptions ps
             JOIN users u ON ps.user_id = u.id
             WHERE u.academy_id = ? AND u.deleted_at IS NULL`,
            [academyId]
        );

        for (const user of users) {
            await createNotification(user.user_id, type, title, message, data);
        }

        return users.length;
    } catch (error) {
        console.error('Error creating notifications for all:', error);
        return 0;
    }
}

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.createNotificationForAllInstructors = createNotificationForAllInstructors;
