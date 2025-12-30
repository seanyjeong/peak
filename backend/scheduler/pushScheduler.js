/**
 * P-EAK 푸시 알림 스케줄러
 *
 * 스케줄:
 * 1. 기록 미입력 알림: 일요일 21:00 KST (모든 강사)
 * 2. 수업계획 미제출 알림: 매일 21:00 KST (해당 강사)
 *
 * v4.3.4: 멀티테넌트 academy_id 필터링 추가
 */

const cron = require('node-cron');
const pool = require('../config/database');
const pacaPool = require('../config/paca-database');
const { sendPushToUser, sendPushToAllInstructors } = require('../routes/push');
const { createNotification, createNotificationForAllInstructors } = require('../routes/notifications');

/**
 * 활성화된 모든 학원 목록 조회
 */
async function getActiveAcademies() {
    const [academies] = await pacaPool.query(`
        SELECT id, name FROM academies WHERE status = 'active' AND deleted_at IS NULL
    `);
    return academies;
}

/**
 * 특정 학원의 기록 미입력 체크 및 알림 발송
 * @param {number} academyId - 학원 ID
 */
async function checkMissingRecordsForAcademy(academyId) {
    try {
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

        // 현재 주차 계산
        const weekOfMonth = Math.ceil(today.getDate() / 7);
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const currentMonth = monthNames[today.getMonth()];

        // 해당 학원의 활성 학생 중 최근 7일 기록 없는 학생 조회 - academy_id 필터 추가
        const [studentsWithoutRecords] = await pool.query(`
            SELECT s.id, s.name, s.school, s.grade
            FROM students s
            WHERE s.academy_id = ?
            AND s.status = 'active'
            AND (s.is_trial = FALSE OR s.is_trial IS NULL)
            AND s.id NOT IN (
                SELECT DISTINCT sr.student_id
                FROM student_records sr
                WHERE sr.academy_id = ? AND sr.measured_at >= ?
            )
            LIMIT 50
        `, [academyId, academyId, weekAgoStr]);

        if (studentsWithoutRecords.length === 0) {
            return { success: true, count: 0 };
        }

        const count = studentsWithoutRecords.length;
        const title = '실기기록 미입력 알림';
        const message = `${currentMonth} ${weekOfMonth}주차 실기기록측정이 이루어지지 않은 학생이 ${count}명 있습니다.`;

        // 푸시 알림 발송 (해당 학원의 구독자만)
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

        const pushResult = await sendPushToAllInstructors(academyId, payload);

        // DB 알림 생성 (해당 학원의 강사들에게만)
        const notifCount = await createNotificationForAllInstructors(
            academyId,
            'record_missing',
            title,
            message,
            { count, studentIds: studentsWithoutRecords.map(s => s.id) }
        );

        return { success: true, count, pushResult, notifCount };

    } catch (error) {
        console.error(`[Scheduler] Error checking missing records for academy ${academyId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * 기록 미입력 체크 및 알림 발송 (모든 학원)
 * 일요일 21:00 KST 실행
 */
async function checkMissingRecords() {
    try {
        console.log('[Scheduler] Checking missing records for all academies...');

        const academies = await getActiveAcademies();
        console.log(`[Scheduler] Found ${academies.length} active academies`);

        for (const academy of academies) {
            const result = await checkMissingRecordsForAcademy(academy.id);
            if (result.success && result.count > 0) {
                console.log(`[Scheduler] Academy ${academy.id}: ${result.count} students without records, ${result.pushResult?.success || 0} push sent`);
            }
        }

        console.log('[Scheduler] Missing records check completed');

    } catch (error) {
        console.error('[Scheduler] Error in checkMissingRecords:', error);
    }
}

/**
 * 특정 학원의 수업계획 미제출 체크 및 알림 발송
 * @param {number} academyId - 학원 ID
 */
async function checkMissingPlansForAcademy(academyId) {
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowFormatted = `${tomorrow.getMonth() + 1}.${String(tomorrow.getDate()).padStart(2, '0')}`;

        // 내일이 주말이면 스킵
        const tomorrowDay = tomorrow.getDay();
        if (tomorrowDay === 0 || tomorrowDay === 6) {
            return { success: true, skipped: true, reason: 'weekend' };
        }

        // 해당 학원의 푸시 구독 유저 중 내일 계획이 없는 사람 찾기 - academy_id 필터 추가
        const [usersWithoutPlan] = await pacaPool.query(`
            SELECT DISTINCT ps.user_id
            FROM peak.push_subscriptions ps
            JOIN users u ON ps.user_id = u.id
            WHERE u.academy_id = ?
            AND u.deleted_at IS NULL
            AND ps.user_id NOT IN (
                SELECT DISTINCT dp.instructor_id
                FROM peak.daily_plans dp
                WHERE dp.academy_id = ? AND dp.date = ?
            )
        `, [academyId, academyId, tomorrowStr]);

        if (usersWithoutPlan.length === 0) {
            return { success: true, count: 0 };
        }

        const title = '수업계획 미제출 알림';
        const message = `${tomorrowFormatted}일 수업계획이 작성되지 않았습니다.`;

        let sentCount = 0;

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
            if (pushResult.success > 0) sentCount++;

            // DB 알림 생성
            await createNotification(
                user.user_id,
                'plan_missing',
                title,
                message,
                { date: tomorrowStr }
            );
        }

        return { success: true, count: usersWithoutPlan.length, sentCount };

    } catch (error) {
        console.error(`[Scheduler] Error checking missing plans for academy ${academyId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * 수업계획 미제출 체크 및 알림 발송 (모든 학원)
 * 매일 21:00 KST 실행 (다음날 수업 예정자 대상)
 */
async function checkMissingPlans() {
    try {
        console.log('[Scheduler] Checking missing plans for all academies...');

        const academies = await getActiveAcademies();
        console.log(`[Scheduler] Found ${academies.length} active academies`);

        for (const academy of academies) {
            const result = await checkMissingPlansForAcademy(academy.id);
            if (result.success && !result.skipped && result.count > 0) {
                console.log(`[Scheduler] Academy ${academy.id}: ${result.count} users without plans, ${result.sentCount} notifications sent`);
            }
        }

        console.log('[Scheduler] Missing plans check completed');

    } catch (error) {
        console.error('[Scheduler] Error in checkMissingPlans:', error);
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
async function runManualCheck(type, academyId = null) {
    if (academyId) {
        // 특정 학원만 체크
        if (type === 'records') {
            return await checkMissingRecordsForAcademy(academyId);
        } else if (type === 'plans') {
            return await checkMissingPlansForAcademy(academyId);
        } else {
            const recordsResult = await checkMissingRecordsForAcademy(academyId);
            const plansResult = await checkMissingPlansForAcademy(academyId);
            return { records: recordsResult, plans: plansResult };
        }
    } else {
        // 모든 학원 체크
        if (type === 'records') {
            await checkMissingRecords();
        } else if (type === 'plans') {
            await checkMissingPlans();
        } else {
            await checkMissingRecords();
            await checkMissingPlans();
        }
    }
}

module.exports = {
    initScheduler,
    checkMissingRecords,
    checkMissingPlans,
    checkMissingRecordsForAcademy,
    checkMissingPlansForAcademy,
    runManualCheck
};
