import { render, screen } from '@testing-library/react';
import apiClient from '@/lib/api/client';
import AttendancePage from '@/app/(pc)/attendance/page';
import StudentAttendancePage from '@/app/(pc)/student-attendance/page';

jest.mock('@/lib/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/hooks/useSocket', () => ({ useSocket: jest.fn() }));

const mockedGet = apiClient.get as jest.Mock;

// 시험학원 설정처럼 기본값과 다른 시각 (QA Q01)
const academyTimeSlots = {
  morning: '09:30-12:00',
  afternoon: '14:00-18:00',
  evening: '18:30-21:00',
};

function mockResponses(timeSlots?: typeof academyTimeSlots) {
  mockedGet.mockImplementation((url: string) => {
    if (url.startsWith('/assignments')) {
      return Promise.resolve({ data: { success: true, slots: {}, ...(timeSlots ? { timeSlots } : {}) } });
    }
    return Promise.resolve({ data: { success: true, slots: {}, stats: {}, branches: [] } });
  });
}

describe('출석·출근 화면 시간대 시각', () => {
  beforeEach(() => mockedGet.mockReset());

  it.each([
    ['출근 체크', AttendancePage],
    ['학생 출석', StudentAttendancePage],
  ])('%s 화면은 학원 설정 시각을 보인다', async (_name, Page) => {
    mockResponses(academyTimeSlots);
    render(<Page />);

    expect(await screen.findByText('09:30-12:00')).toBeInTheDocument();
    expect(screen.getByText('14:00-18:00')).toBeInTheDocument();
    expect(screen.getAllByText(/18:30-21:00/).length).toBeGreaterThan(0);
    expect(screen.queryByText('09:00-12:00')).not.toBeInTheDocument();
  });

  it.each([
    ['출근 체크', AttendancePage],
    ['학생 출석', StudentAttendancePage],
  ])('%s 화면은 학원 설정 시각이 없으면 기본 시각을 보인다', async (_name, Page) => {
    mockResponses();
    render(<Page />);

    expect(await screen.findByText('09:00-12:00')).toBeInTheDocument();
    expect(screen.getByText('13:00-17:00')).toBeInTheDocument();
  });
});
