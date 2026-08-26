import { chromium } from 'playwright';

const DEFAULT_BASE_URL = process.env.PEAK_SMOKE_BASE_URL || 'http://localhost:3110';

export async function launchSmokeBrowser() {
  return chromium.launch({ headless: true });
}

export async function createAuthedPage(browser, viewport = { width: 1440, height: 960 }) {
  const context = await browser.newContext({
    baseURL: DEFAULT_BASE_URL,
    viewport,
  });
  await context.addInitScript(() => {
    window.__PEAK_SMOKE__ = true;
    localStorage.setItem('peak_token', 'smoke-token');
    localStorage.setItem('peak_user', JSON.stringify({
      id: 1,
      email: 'owner@example.com',
      name: '테스트 원장',
      role: 'owner',
      academyId: 2,
      position: '원장',
    }));
    sessionStorage.setItem('alertShown', 'true');
    localStorage.setItem('peak-ui-theme', 'light');
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page };
}

export function createDiagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });

  return { consoleMessages, failedRequests, pageErrors };
}

export async function mockPeakApi(context, state = {}) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    state.hits ||= [];
    state.hits.push(`${request.method()} ${path}${url.search}`);
    if (request.method() !== 'GET') {
      state.bodies ||= [];
      state.bodies.push({ path, body: request.postDataJSON() });
    }

    if (request.method() === 'GET' && path === '/assignments') {
      return jsonRoute(route, makeAssignments());
    }

    if (request.method() === 'POST' && path === '/assignments/sync') {
      return jsonRoute(route, { success: true, synced: true });
    }

    if (request.method() === 'POST' && path === '/assignments/reset') {
      return jsonRoute(route, { success: true });
    }

    if (request.method() === 'GET' && path === '/presets') {
      return jsonRoute(route, makePresets());
    }

    if (request.method() === 'GET' && path === '/presets/instructors') {
      return jsonRoute(route, {
        instructors: [
          { id: -1, name: '테스트 원장' },
          { id: 6, name: '최코치' },
          { id: 9, name: '윤코치' },
        ],
      });
    }

    if (request.method() === 'POST' && path === '/presets/10/apply') {
      return jsonRoute(route, {
        success: true,
        result: { classes_created: 2, students_assigned: 6, students_unmatched: 0, instructors_absent: 0 },
      });
    }

    if (request.method() === 'GET' && path === '/students') {
      return jsonRoute(route, makeActiveStudents());
    }

    if (request.method() === 'GET' && path === '/attendance/current') {
      return jsonRoute(route, makeCurrentAttendance());
    }

    if (request.method() === 'GET' && path === '/attendance') {
      return jsonRoute(route, makeAttendance());
    }

    if (request.method() === 'GET' && path === '/attendance/students') {
      return jsonRoute(route, makeStudentAttendance());
    }

    if (request.method() === 'POST' && path === '/attendance/student') {
      return jsonRoute(route, { success: true, message: '저장했습니다.' });
    }

    if (request.method() === 'POST' && path === '/attendance/student/batch') {
      return jsonRoute(route, { success: true, updated: 1, total: 1 });
    }

    if (request.method() === 'GET' && path === '/auth/me') {
      return jsonRoute(route, { user: { id: 1, name: '테스트 원장', role: 'owner', academyId: 2 } });
    }

    if (request.method() === 'GET' && path === '/permissions/me') {
      return jsonRoute(route, {
        success: true,
        permissions: { analyticsReport: true, measurementSettingsManage: true, canManagePermissions: true },
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

export async function jsonRoute(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body),
  });
}

export async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return Math.max(0, document.documentElement.scrollWidth - width);
  });
  if (overflow > 1) throw new Error(`${label} horizontal overflow ${overflow}px`);
}

export function assertNoConsoleProblems(diagnostics, label) {
  if (diagnostics.pageErrors.length) {
    throw new Error(`${label} page errors: ${diagnostics.pageErrors.join(' | ')}`);
  }
  const relevantConsole = diagnostics.consoleMessages.filter((message) => (
    !message.includes('Failed to load resource')
  ));
  if (relevantConsole.length) {
    throw new Error(`${label} console errors: ${relevantConsole.join(' | ')}`);
  }
  const relevantFailedRequests = diagnostics.failedRequests.filter((message) => (
    !(message.includes('?_rsc=') && message.endsWith('net::ERR_ABORTED'))
  ));
  if (relevantFailedRequests.length) {
    throw new Error(`${label} failed requests: ${relevantFailedRequests.join(' | ')}`);
  }
}

export async function stabilizeForScreenshot(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(4, 4);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.waitForTimeout(250);
}

function makeAssignments() {
  const student = (id, studentId, name, gender, options = {}) => ({
    id,
    student_id: studentId,
    student_name: name,
    gender,
    school: options.school || '정발고',
    grade: options.grade || '고3',
    is_trial: options.is_trial || false,
    trial_total: options.trial_total || 0,
    trial_remaining: options.trial_remaining || 0,
    status: options.status || 'enrolled',
    attendance_status: options.attendance_status || 'scheduled',
    absence_reason: options.absence_reason || null,
  });

  return {
    success: true,
    timeSlots: {
      morning: '09:00-12:00',
      afternoon: '13:00-17:00',
      evening: '18:00-21:00',
    },
    slots: {
      morning: {
        waitingInstructors: [],
        waitingStudents: [student(21, 321, '박서준', 'M')],
        classes: [
          {
            class_num: 1,
            instructors: [{ id: 4, name: '김코치', isOwner: false, isMain: true }],
            students: [
              student(11, 311, '김서연', 'F'),
              student(12, 312, '이도윤', 'M'),
              student(13, 313, '한지우', 'F', { status: 'trial', is_trial: true, trial_total: 2, trial_remaining: 1 }),
            ],
          },
        ],
      },
      afternoon: {
        waitingInstructors: [{ id: 9, name: '윤코치', isOwner: false }],
        waitingStudents: [student(22, 322, '최민준', 'M')],
        classes: [
          {
            class_num: 2,
            instructors: [{ id: 5, name: '이코치', isOwner: false, isMain: true }],
            students: [student(14, 314, '유민재', 'M'), student(15, 315, '정하린', 'F')],
          },
        ],
      },
      evening: {
        waitingInstructors: [{ id: -1, name: '테스트 원장', isOwner: true }],
        waitingStudents: [student(23, 323, '오지안', 'F', { attendance_status: 'absent', absence_reason: '병원' })],
        classes: [
          {
            class_num: 3,
            instructors: [{ id: 6, name: '최코치', isOwner: false, isMain: true }],
            students: [
              student(16, 316, '강하늘', 'M'),
              student(17, 317, '문태오', 'M'),
              student(18, 318, '배수아', 'F'),
              student(19, 319, '서로운', 'M'),
            ],
          },
        ],
      },
    },
  };
}

function makePresets() {
  return {
    presets: [
      {
        id: 10,
        name: '기본 배치',
        type: 'homeroom',
        is_active: true,
        groups: [
          {
            id: 701,
            name: '최코치반',
            instructor_id: 6,
            instructor_name: '최코치',
            order_num: 1,
            members: [
              { student_id: 316, name: '강하늘', gender: 'M', grade: '고3', school: '대진고', status: 'enrolled' },
              { student_id: 317, name: '문태오', gender: 'M', grade: '고1', school: '동패고', status: 'enrolled' },
            ],
          },
          {
            id: 702,
            name: '윤코치반',
            instructor_id: 9,
            instructor_name: '윤코치',
            order_num: 2,
            members: [
              { student_id: 318, name: '배수아', gender: 'F', grade: '고2', school: '저동고', status: 'enrolled' },
            ],
          },
        ],
      },
    ],
  };
}

function makeActiveStudents() {
  return {
    students: [
      { id: 316, student_id: 316, name: '강하늘', gender: 'M', grade: '고3', school: '대진고', status: 'enrolled' },
      { id: 317, student_id: 317, name: '문태오', gender: 'M', grade: '고1', school: '동패고', status: 'enrolled' },
      { id: 318, student_id: 318, name: '배수아', gender: 'F', grade: '고2', school: '저동고', status: 'enrolled' },
      { id: 319, student_id: 319, name: '서로운', gender: 'M', grade: '고3', school: '정발고', status: 'enrolled' },
      { id: 320, student_id: 320, name: '정하린', gender: 'F', grade: '고2', school: '저동고', status: 'enrolled' },
    ],
  };
}

function makeCurrentAttendance() {
  return {
    success: true,
    currentSlot: 'evening',
    currentSlotLabel: '저녁반',
    stats: { scheduled: 3, checkedIn: 2, notCheckedIn: 1 },
    instructors: [
      { id: 4, name: '김코치', checkedIn: true, checkInTime: '17:54:00' },
      { id: 5, name: '이코치', checkedIn: true, checkInTime: '17:58:00' },
      { id: 6, name: '최코치', checkedIn: false, checkInTime: null },
    ],
  };
}

function makeAttendance() {
  return {
    success: true,
    stats: { total: 5, checkedIn: 3, uniqueInstructors: 4 },
    slots: {
      morning: [
        { id: 4, name: '김코치', time_slot: 'morning', attendance_status: 'present', check_in_time: '08:54:00', check_out_time: null },
        { id: 5, name: '이코치', time_slot: 'morning', attendance_status: 'scheduled', check_in_time: null, check_out_time: null },
      ],
      afternoon: [
        { id: 6, name: '최코치', time_slot: 'afternoon', attendance_status: 'late', check_in_time: '13:12:00', check_out_time: null },
      ],
      evening: [
        { id: 7, name: '박코치', time_slot: 'evening', attendance_status: 'present', check_in_time: '17:57:00', check_out_time: null },
        { id: 8, name: '정코치', time_slot: 'evening', attendance_status: 'absent', check_in_time: null, check_out_time: null },
      ],
    },
  };
}

function makeStudentAttendance() {
  return {
    success: true,
    stats: { total: 5, present: 2, absent: 1, late: 0, excused: 0, unchecked: 2 },
    slots: {
      morning: [
        {
          assignment_id: 101,
          student_id: 201,
          student_name: '김서연',
          gender: 'F',
          school: '백마고',
          grade: '고2',
          class_id: 1,
          is_trial: 0,
          paca_attendance_id: 501,
          attendance_status: 'present',
          notes: null,
        },
      ],
      afternoon: [
        {
          assignment_id: 102,
          student_id: 202,
          student_name: '유민재',
          gender: 'M',
          school: '정발고',
          grade: '고3',
          class_id: 2,
          is_trial: 0,
          paca_attendance_id: 502,
          attendance_status: null,
          notes: null,
        },
      ],
      evening: [
        {
          assignment_id: 103,
          student_id: 203,
          student_name: '강하늘',
          gender: 'M',
          school: '대진고',
          grade: '고3',
          class_id: 3,
          is_trial: 1,
          paca_attendance_id: 503,
          attendance_status: null,
          notes: null,
        },
        {
          assignment_id: 104,
          student_id: 204,
          student_name: '오지안',
          gender: 'F',
          school: '저동고',
          grade: '고2',
          class_id: 3,
          is_trial: 0,
          paca_attendance_id: 504,
          attendance_status: 'absent',
          notes: null,
        },
        {
          assignment_id: 105,
          student_id: 205,
          student_name: '문태오',
          gender: 'M',
          school: '동패고',
          grade: '고1',
          class_id: null,
          is_trial: 0,
          paca_attendance_id: null,
          attendance_status: null,
          notes: null,
        },
      ],
    },
  };
}
