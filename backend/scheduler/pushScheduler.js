/**
 * P-EAK 푸시 알림 스케줄러
 *
 * 스케줄:
 * 1. 기록 미입력 알림: 일요일 21:00 KST (모든 강사)
 * 2. 수업계획 미제출 알림: 매일 21:00 KST (해당 강사)
 */

const cron = require('node-cron');
const pool = require('../config/database');
const { sendPushToUser, sendPushToAllInstructors } = require('../routes/push');
const { createNotification, createNotificationForAllInstructors } = require('../routes/notifications');

/**
 * 기록 미입력 체크 및 알림 발송
 * 일요일 21:00 KST 실행
 */
async function checkMissingRecords() {
    try {
        console.log('[Scheduler] Checking missing records...');

        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

        // 현재 주차 계산
        const weekOfMonth = Math.ceil(today.getDate() / 7);
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const currentMonth = monthNames[today.getMonth()];

        // 활성 학생 중 최근 7일 기록 없는 학생 조회
        const [studentsWithoutRecords] = await pool.query(`
            SELECT s.id, s.name, s.school, s.grade
            FROM students s
            WHERE s.status = 'active'
            AND s.id NOT IN (
                SELECT DISTINCT sr.student_id
                FROM student_records sr
                WHERE sr.measured_at >= ?
            )
            LIMIT 50
        `, [weekAgoStr]);

        if (studentsWithoutRecords.length === 0) {
            console.log('[Scheduler] No missing records found');
            return;
        }

        const count = studentsWithoutRecords.length;
        const title = '실기기록 미입력 알림';
        const message = `${currentMonth} ${weekOfMonth}주차 실기기록측정이 이루어지지 않은 학생이 ${count}명 있습니다.`;

        // 푸시 알림 발송 (모든 구독자)
        const payload = {
            title,
            body: message,
            icon: '/peak-192x192.png',
            badge: '/peak-192x192.png',
            data: {
                type: 'record_missing',
                url: '/records',
                count
            }
        };

        const pushResult = await sendPushToAllInstructors(payload);
        console.log(`[Scheduler] Push sent: ${pushResult.success} success, ${pushResult.failed} failed`);

        // DB 알림 생성
        const notifCount = await createNotificationForAllInstructors(
            'record_missing',
            title,
            message,
            { count, studentIds: studentsWithoutRecords.map(s => s.id) }
        );
        console.log(`[Scheduler] Created ${notifCount} notifications`);

    } catch (error) {
        console.error('[Scheduler] Error checking missing records:', error);
    }
}

/**
 * 수업계획 미제출 체크 및 알림 발송
 * 매일 21:00 KST 실행 (다음날 수업 예정자 대상)
 */
async function checkMissingPlans() {
    try {
        console.log('[Scheduler] Checking missing plans...');

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowFormatted = `${tomorrow.getMonth() + 1}.${String(tomorrow.getDate()).padStart(2, '0')}`;

        // 내일이 주말이면 스킵
        const tomorrowDay = tomorrow.getDay();
        if (tomorrowDay === 0 || tomorrowDay === 6) {
            console.log('[Scheduler] Tomorrow is weekend, skipping plan check');
            return;
        }

        // 푸시 구독한 모든 유저 중 내일 계획이 없는 사람 찾기
        const [usersWithoutPlan] = await pool.query(`
            SELECT DISTINCT ps.user_id
            FROM push_subscriptions ps
            WHERE ps.user_id NOT IN (
                SELECT DISTINCT dp.instructor_id
                FROM daily_plans dp
                WHERE dp.date = ?
            )
        `, [tomorrowStr]);

        if (usersWithoutPlan.length === 0) {
            console.log('[Scheduler] All instructors have plans for tomorrow');
            return;
        }

        const title = '수업계획 미제출 알림';
        const message = `${tomorrowFormatted}일 수업계획이 작성되지 않았습니다.`;

        // 각 유저에게 개별 알림
        for (const user of usersWithoutPlan) {
            const payload = {
                title,
                body: message,
                icon: '/peak-192x192.png',
                badge: '/peak-192x192.png',
                data: {
                    type: 'plan_missing',
                    url: '/plans',
                    date: tomorrowStr
                }
            };

            // 푸시 발송
            const pushResult = await sendPushToUser(user.user_id, payload);
            console.log(`[Scheduler] Push to user ${user.user_id}: ${pushResult.success} success`);

            // DB 알림 생성
            await createNotification(
                user.user_id,
                'plan_missing',
                title,
                message,
                { date: tomorrowStr }
            );
        }

        console.log(`[Scheduler] Sent plan reminders to ${usersWithoutPlan.length} users`);

    } catch (error) {
        console.error('[Scheduler] Error checking missing plans:', error);
    }
}

/**
 * 스케줄러 초기화
 */
function initScheduler() {
    console.log('[Scheduler] Initializing push notification scheduler...');

    // 기록 미입력 알림: 일요일 21:00 KST
    // cron: 분 시 일 월 요일 (0=일요일)
    // KST = UTC+9, 21:00 KST = 12:00 UTC
    cron.schedule('0 12 * * 0', () => {
        console.log('[Scheduler] Running weekly record check (Sunday 21:00 KST)');
        checkMissingRecords();
    }, {
        timezone: 'Asia/Seoul'
    });

    // 수업계획 미제출 알림: 매일 21:00 KST
    cron.schedule('0 21 * * *', () => {
        console.log('[Scheduler] Running daily plan check (21:00 KST)');
        checkMissingPlans();
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[Scheduler] Schedules registered:');
    console.log('  - Record check: Every Sunday at 21:00 KST');
    console.log('  - Plan check: Every day at 21:00 KST');
}

// 테스트용 수동 실행 함수
async function runManualCheck(type) {
    if (type === 'records') {
        await checkMissingRecords();
    } else if (type === 'plans') {
        await checkMissingPlans();
    } else {
        await checkMissingRecords();
        await checkMissingPlans();
    }
}

module.exports = {
    initScheduler,
    checkMissingRecords,
    checkMissingPlans,
    runManualCheck
};
