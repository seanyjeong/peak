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
  const { context, diagnostics, page } = await createAuthedPage(browser, { width: 390, height: 844 });

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    if (request.method() === 'GET' && path === '/mobile/my-class') return jsonRoute(route, makeMyClass());
    if (request.method() === 'GET' && path === '/mobile/stats') return jsonRoute(route, makeStats());
    if (request.method() === 'GET' && path === '/assignments') return jsonRoute(route, makeAssignments());
    if (request.method() === 'GET' && path === '/plans') return jsonRoute(route, makePlans());
    if (request.method() === 'GET' && path === '/training') return jsonRoute(route, { logs: [{ id: 77, student_id: 201, condition_score: 3, notes: '' }] });
    if (request.method() === 'GET' && path === '/exercise-tags') return jsonRoute(route, makeTags());
    if (request.method() === 'GET' && path === '/exercises') return jsonRoute(route, makeExercises());
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/records/by-date') return jsonRoute(route, { records: [] });
    return jsonRoute(route, { success: true, message: 'mocked' });
  });

  const routes = [
    ['/mobile/my-class', '배정된 학생이 없습니다'],
    ['/mobile/plans', '계획 추가'],
    ['/mobile/training', '학생 컨디션'],
    ['/mobile/records', '전체 펼치기'],
    ['/mobile/stats', '통계'],
  ];

  for (const [path, text] of routes) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.getByText(text).first().waitFor();
    if (path === '/mobile/training' || path === '/mobile/records') {
      await page.getByLabel('강사별 보기').selectOption('5');
      await page.getByText('오하늘').first().waitFor();
      await page.getByText('김서연').first().waitFor({ state: 'detached' });
    }
    await assertNoHorizontalOverflow(page, path);
  }

  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-mobile-routes.png', fullPage: true });
  diagnostics.failedRequests = diagnostics.failedRequests.filter((entry) => {
    const isStaticAbort = entry.includes('net::ERR_ABORTED')
      && (entry.includes('/_next/static/') || entry.includes('/_next/image?'));
    return !isStaticAbort;
  });
  assertNoConsoleProblems(diagnostics, 'mobile routes');
  await browser.close();
}

function makeMyClass() {
  return { hasClass: true, slots: { morning: null, afternoon: null, evening: { students: [], plan: [], stats: { total: 0, present: 0, absent: 0, late: 0 } } } };
}

function makeStats() {
  return { period: 'week', startDate: '2026-06-18', endDate: '2026-06-24', attendance: { present: 8, absent: 1, late: 0, excused: 0, total: 9, rate: 89 }, dailyRates: [{ date: '2026-06-24', rate: 89, total: 9, present: 8 }], recentRecords: [{ measured_at: '2026-06-24', student_count: 2, record_count: 4 }], plans: { total: 1, checked: 1 } };
}

function makeAssignments() {
  return {
    slots: {
      morning: {
        waitingStudents: [],
        waitingInstructors: [],
        classes: [
          { class_num: 1, instructors: [{ id: 4, name: '김코치', isOwner: false }], students: [{ id: 1, student_id: 201, student_name: '김서연', gender: 'F' }] },
          { class_num: 2, instructors: [{ id: 5, name: '이코치', isOwner: false }], students: [{ id: 2, student_id: 202, student_name: '오하늘', gender: 'M' }] },
        ],
      },
    },
  };
}

function makePlans() {
  return {
    plans: [
      { id: 20, date: '2026-06-24', time_slot: 'morning', instructor_id: 4, instructor_name: '김코치', tags: ['lower'], exercises: [{ exercise_id: 1, name: '스쿼트', note: '기본' }], completed_exercises: [], exercise_times: {} },
      { id: 21, date: '2026-06-24', time_slot: 'morning', instructor_id: 5, instructor_name: '이코치', tags: ['lower'], exercises: [{ exercise_id: 2, name: '런지', note: '기본' }], completed_exercises: [], exercise_times: {} },
    ],
  };
}

function makeTags() {
  return { tags: [{ id: 1, tag_id: 'lower', label: '하체', color: 'bg-emerald-100 text-emerald-700' }] };
}

function makeExercises() {
  return { exercises: [{ id: 1, name: '스쿼트', tags: ['lower'], default_sets: 3, default_reps: 10 }] };
}

function makeRecordTypes() {
  return { recordTypes: [{ id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher', is_active: true, min_value: 100, max_value: 350 }] };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
