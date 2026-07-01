import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  jsonRoute,
  launchSmokeBrowser,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function main() {
  const browser = await launchSmokeBrowser();
  const { context, diagnostics, page } = await createAuthedPage(browser, { width: 1024, height: 900 });

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    if (request.method() === 'GET' && path === '/assignments') return jsonRoute(route, makeAssignments());
    if (request.method() === 'GET' && path === '/attendance/current') return jsonRoute(route, makeCurrentAttendance());
    if (request.method() === 'GET' && path === '/attendance') return jsonRoute(route, makeAttendance());
    if (request.method() === 'GET' && path === '/attendance/students') return jsonRoute(route, makeStudentAttendance());
    if (request.method() === 'GET' && path === '/presets') return jsonRoute(route, makePresets());
    if (request.method() === 'GET' && path === '/presets/instructors') return jsonRoute(route, { instructors: [{ id: -1, name: '테스트 원장' }] });
    if (request.method() === 'GET' && path === '/students') return jsonRoute(route, makeStudents());
    if (request.method() === 'GET' && path === '/plans') return jsonRoute(route, makePlans());
    if (request.method() === 'GET' && path === '/training') return jsonRoute(route, { success: true, logs: [] });
    if (request.method() === 'GET' && path === '/exercises') return jsonRoute(route, makeExercises());
    if (request.method() === 'GET' && path === '/exercise-tags') return jsonRoute(route, makeTags());
    if (request.method() === 'GET' && path === '/exercise-packs') return jsonRoute(route, { packs: [] });
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path.startsWith('/score-tables/by-type/')) return jsonRoute(route, makeScoreTable());
    if (request.method() === 'GET' && path === '/score-tables') return jsonRoute(route, { scoreTables: [] });
    if (request.method() === 'GET' && path === '/records/by-date') return jsonRoute(route, { success: true, records: [] });
    if (request.method() === 'GET' && path === '/monthly-tests') return jsonRoute(route, makeMonthlyTests());
    if (request.method() === 'GET' && path === '/settings') return jsonRoute(route, { settings: { slug: 'ilsanmax' } });
    return jsonRoute(route, { success: true, message: 'mocked' });
  });

  const routes = [
    ['/tablet/dashboard', '대시보드'],
    ['/tablet/attendance', '출근 체크'],
    ['/tablet/student-attendance', '학생 출석'],
    ['/tablet/assignments', '반 배치'],
    ['/tablet/presets', '반 프리셋'],
    ['/tablet/plans', '수업 계획'],
    ['/tablet/training', '수업 기록'],
    ['/tablet/records', '기록 측정'],
    ['/tablet/settings', '실기 측정 설정'],
    ['/tablet/exercises', '운동 관리'],
    ['/tablet/monthly-test', '월말테스트'],
    ['/tablet/students', '학생 관리'],
  ];

  for (const [path, heading] of routes) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: heading, exact: true }).last().waitFor();
    await assertNoHorizontalOverflow(page, path);
  }

  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-tablet-routes.png', fullPage: true });
  diagnostics.failedRequests = diagnostics.failedRequests.filter((entry) => {
    const isStaticAbort = entry.includes('net::ERR_ABORTED')
      && (entry.includes('/_next/static/') || entry.includes('/_next/image?'));
    return !isStaticAbort;
  });
  assertNoConsoleProblems(diagnostics, 'tablet routes');
  await browser.close();
}

function makeAssignments() {
  const student = { id: 1, student_id: 201, student_name: '김서연', gender: 'F', status: 'enrolled', attendance_status: 'present' };
  return {
    success: true,
    slots: {
      morning: { waitingStudents: [], waitingInstructors: [], classes: [] },
      afternoon: { waitingStudents: [], waitingInstructors: [], classes: [] },
      evening: { waitingStudents: [], waitingInstructors: [], classes: [{ class_num: 1, instructors: [{ id: -1, name: '테스트 원장', isOwner: true, isMain: true }], students: [student] }] },
    },
  };
}

function makeCurrentAttendance() {
  return {
    success: true,
    currentSlot: 'evening',
    currentSlotLabel: '저녁반',
    instructors: [{ id: 1, name: '테스트 원장', checkedIn: true, checkInTime: '18:00' }],
    stats: { scheduled: 1, checkedIn: 1, notCheckedIn: 0 },
  };
}

function makeAttendance() {
  return { slots: { morning: [], afternoon: [], evening: [{ id: 1, name: '테스트 원장', time_slot: 'evening', attendance_status: 'present', check_in_time: '18:00', check_out_time: null }] }, stats: { total: 1, checkedIn: 1, uniqueInstructors: 1 } };
}

function makeStudentAttendance() {
  return { slots: { morning: [], afternoon: [], evening: [{ assignment_id: 1, student_id: 201, student_name: '김서연', gender: 'F', school: '백마고', grade: '고2', paca_attendance_id: 501, attendance_status: 'present' }] }, stats: { total: 1, present: 1, absent: 0, late: 0, excused: 0, unchecked: 0 } };
}

function makePresets() {
  return { presets: [{ id: 1, name: '기본 프리셋', type: 'homeroom', is_active: true, groups: [] }] };
}

function makeStudents() {
  return { students: [{ id: 201, paca_student_id: 1201, name: '김서연', gender: 'F', school: '백마고', grade: '고2', class_days: [1, 3], is_trial: false, trial_total: 0, trial_remaining: 0, join_date: '2026-03-01', status: 'active' }] };
}

function makePlans() {
  return {
    success: true,
    slots: {
      morning: [],
      afternoon: [],
      evening: [{ id: -1, name: '테스트 원장', user_id: 1, time_slot: 'evening', isOwner: true }],
    },
    plans: [{ id: 20, date: '2026-06-24', time_slot: 'evening', instructor_id: -1, instructor_name: '테스트 원장', tags: ['lower'], exercises: [{ exercise_id: 1, name: '스쿼트', note: '기본' }], completed_exercises: [], extra_exercises: [], exercise_times: {}, conditions_checked: 0, conditions_checked_at: null, temperature: null, humidity: null, description: '기본 루틴' }],
  };
}

function makeExercises() {
  return { exercises: [{ id: 1, name: '스쿼트', tags: ['lower'], default_sets: 3, default_reps: 10, description: '기본', video_url: null }] };
}

function makeTags() {
  return { tags: [{ id: 1, tag_id: 'lower', label: '하체', color: 'bg-emerald-100 text-emerald-700', display_order: 1, is_active: true }] };
}

function makeRecordTypes() {
  return { recordTypes: [{ id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher', is_active: true, min_value: 100, max_value: 350 }] };
}

function makeScoreTable() {
  return { scoreTable: { id: 1, decimal_places: 0, min_score: 1 }, ranges: [] };
}

function makeMonthlyTests() {
  return { tests: [{ id: 1, test_month: '2026-06', test_name: '6월 실기 테스트', status: 'active', notes: null, session_count: 1, participant_count: 3, created_at: '2026-06-24T00:00:00.000Z' }] };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
