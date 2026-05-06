/**
 * Class Naming Tests (v5.3.4)
 *
 * 반 이름 표시 규칙:
 * - 반배치: 주강사 있으면 "강사이름반", 없으면 "N반"
 * - 프리셋: 강사 선택 시 그룹 이름 자동으로 "강사이름반" 설정
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dnd-kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  pointerWithin: jest.fn(),
  PointerSensor: jest.fn(),
  KeyboardSensor: jest.fn(),
  TouchSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
  useDroppable: jest.fn(() => ({ setNodeRef: jest.fn(), isOver: false })),
  useDraggable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  })),
}));

// Mock apiClient
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
});

// Mock useSocket
jest.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: true }),
}));

// ============================================================
// 1. 반배치 페이지: 반 이름 표시 테스트
// ============================================================
describe('반배치 - 반 이름 표시', () => {
  // 반 이름 생성 로직 (assignments 페이지에서 추출)
  function getClassName(classData: {
    class_num: number;
    instructors: Array<{ id: number; name: string; isMain?: boolean }>;
  }): string {
    const mainInstructor = classData.instructors.find(i => i.isMain);
    return mainInstructor ? `${mainInstructor.name}반` : `${classData.class_num}반`;
  }

  it('주강사 있으면 "강사이름반" 형식으로 표시', () => {
    const classData = {
      class_num: 1,
      instructors: [
        { id: 1, name: '김철수', isMain: true },
        { id: 2, name: '이영희', isMain: false },
      ],
    };
    expect(getClassName(classData)).toBe('김철수반');
  });

  it('강사 없으면 "N반" 형식으로 표시', () => {
    const classData = {
      class_num: 3,
      instructors: [],
    };
    expect(getClassName(classData)).toBe('3반');
  });

  it('주강사 없이 보조강사만 있으면 "N반" 형식으로 표시', () => {
    const classData = {
      class_num: 2,
      instructors: [
        { id: 1, name: '박민수', isMain: false },
      ],
    };
    expect(getClassName(classData)).toBe('2반');
  });

  it('"T" 형식이 아닌 "반" 형식 사용 확인', () => {
    const classData = {
      class_num: 1,
      instructors: [{ id: 1, name: '김철수', isMain: true }],
    };
    const name = getClassName(classData);
    expect(name).not.toContain('T');
    expect(name).toEndWith('반');
  });

  it('여러 반의 이름이 각각의 주강사 기준으로 생성', () => {
    const classes = [
      { class_num: 1, instructors: [{ id: 1, name: '김철수', isMain: true }] },
      { class_num: 2, instructors: [{ id: 2, name: '이영희', isMain: true }] },
      { class_num: 3, instructors: [] },
    ];
    const names = classes.map(getClassName);
    expect(names).toEqual(['김철수반', '이영희반', '3반']);
  });
});

// ============================================================
// 2. 프리셋: 강사 선택 시 자동 이름 설정 테스트
// ============================================================
describe('프리셋 - 강사 선택 시 자동 이름 설정', () => {
  // 프리셋의 handlePickInstructor 로직 (presets 페이지에서 추출)
  function handlePickInstructor(
    instructorId: number | null,
    instructors: Array<{ id: number; name: string }>,
    groupId: number,
    onUpdateGroup: (groupId: number, data: Record<string, unknown>) => void,
  ) {
    if (instructorId !== null) {
      const instructor = instructors.find(i => i.id === instructorId);
      if (instructor) {
        onUpdateGroup(groupId, { instructor_id: instructorId, name: `${instructor.name}반` });
      } else {
        onUpdateGroup(groupId, { instructor_id: instructorId });
      }
    } else {
      onUpdateGroup(groupId, { instructor_id: instructorId });
    }
  }

  const instructors = [
    { id: 1, name: '김철수' },
    { id: 2, name: '이영희' },
    { id: -1, name: '원장님' },
  ];

  it('강사 선택 시 그룹 이름이 "강사이름반"으로 자동 설정', () => {
    const onUpdateGroup = jest.fn();
    handlePickInstructor(1, instructors, 10, onUpdateGroup);

    expect(onUpdateGroup).toHaveBeenCalledWith(10, {
      instructor_id: 1,
      name: '김철수반',
    });
  });

  it('다른 강사 선택 시 해당 강사 이름으로 변경', () => {
    const onUpdateGroup = jest.fn();
    handlePickInstructor(2, instructors, 10, onUpdateGroup);

    expect(onUpdateGroup).toHaveBeenCalledWith(10, {
      instructor_id: 2,
      name: '이영희반',
    });
  });

  it('원장 선택 시에도 "원장님반"으로 설정', () => {
    const onUpdateGroup = jest.fn();
    handlePickInstructor(-1, instructors, 10, onUpdateGroup);

    expect(onUpdateGroup).toHaveBeenCalledWith(10, {
      instructor_id: -1,
      name: '원장님반',
    });
  });

  it('강사 해제(null) 시 이름 변경 없이 instructor_id만 null로 설정', () => {
    const onUpdateGroup = jest.fn();
    handlePickInstructor(null, instructors, 10, onUpdateGroup);

    expect(onUpdateGroup).toHaveBeenCalledWith(10, {
      instructor_id: null,
    });
    // name 필드가 포함되지 않아야 함
    expect(onUpdateGroup.mock.calls[0][1]).not.toHaveProperty('name');
  });

  it('존재하지 않는 강사 ID 선택 시 이름 변경 없이 instructor_id만 설정', () => {
    const onUpdateGroup = jest.fn();
    handlePickInstructor(999, instructors, 10, onUpdateGroup);

    expect(onUpdateGroup).toHaveBeenCalledWith(10, {
      instructor_id: 999,
    });
    expect(onUpdateGroup.mock.calls[0][1]).not.toHaveProperty('name');
  });
});

// ============================================================
// 3. 반배치 페이지 렌더링 통합 테스트
// ============================================================
describe('반배치 페이지 - 반 이름 렌더링', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('반배치 페이지에서 주강사 이름 기반 반 이름이 렌더링됨', async () => {
    const mockStudent = {
      id: 101,
      student_id: 1001,
      student_name: '홍길동',
      gender: 'M',
      school: null,
      grade: null,
      is_trial: false,
      trial_total: 0,
      trial_remaining: 0,
      status: 'enrolled',
    };
    const slotsData = {
      morning: { waitingStudents: [], waitingInstructors: [], classes: [] },
      afternoon: { waitingStudents: [], waitingInstructors: [], classes: [] },
      evening: {
        waitingStudents: [],
        waitingInstructors: [],
        classes: [
          {
            class_num: 1,
            instructors: [{ id: 1, name: '김철수', isOwner: false, isMain: true }],
            students: [mockStudent],
          },
          {
            class_num: 2,
            instructors: [],
            students: [{ ...mockStudent, id: 102, student_id: 1002, student_name: '김영희' }],
          },
        ],
      },
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/assignments')) {
        return Promise.resolve({ data: { slots: slotsData } });
      }
      if (url.includes('/presets')) {
        return Promise.resolve({ data: { presets: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    mockPost.mockResolvedValue({ data: {} });

    const AssignmentsPage = (await import('@/app/(pc)/assignments/page')).default;
    render(<AssignmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('김철수반')).toBeInTheDocument();
    });

    expect(screen.getByText('2반')).toBeInTheDocument();
    // "T" 형식이 없어야 함
    expect(screen.queryByText('김철수T')).not.toBeInTheDocument();
  });
});

// ============================================================
// 4. 프리셋 페이지 렌더링 통합 테스트
// ============================================================
describe('프리셋 페이지 - 강사 선택 시 이름 자동 변경', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('강사 선택 시 그룹 이름 업데이트 API가 "강사이름반"으로 호출됨', async () => {
    const presetsData = {
      presets: [
        {
          id: 1,
          name: '담임제',
          type: 'homeroom',
          is_active: true,
          groups: [
            {
              id: 10,
              name: '새 담임반',
              instructor_id: null,
              instructor_name: null,
              order_num: 1,
              members: [],
            },
          ],
        },
      ],
    };

    const instructorsData = {
      instructors: [
        { id: 1, name: '김철수' },
        { id: 2, name: '이영희' },
      ],
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/presets/instructors')) {
        return Promise.resolve({ data: instructorsData });
      }
      if (url.includes('/presets')) {
        return Promise.resolve({ data: presetsData });
      }
      if (url.includes('/students')) {
        return Promise.resolve({ data: { students: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    mockPut.mockResolvedValue({ data: {} });

    const PresetsPage = (await import('@/app/(pc)/presets/page')).default;
    render(<PresetsPage />);

    // 프리셋 로딩 대기
    await waitFor(() => {
      expect(screen.getByText('새 담임반')).toBeInTheDocument();
    });

    // 강사 선택 드롭다운 열기
    const instructorButton = screen.getByText('강사 선택');
    fireEvent.click(instructorButton);

    // 김철수 선택
    await waitFor(() => {
      expect(screen.getByText('김철수')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('김철수'));

    // API가 name: '김철수반' 으로 호출되었는지 확인
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/presets/groups/10',
        expect.objectContaining({
          instructor_id: 1,
          name: '김철수반',
        })
      );
    });
  });

  it('강사 해제 시 이름 변경 없이 instructor_id만 null로 호출됨', async () => {
    const presetsData = {
      presets: [
        {
          id: 1,
          name: '담임제',
          type: 'homeroom',
          is_active: true,
          groups: [
            {
              id: 10,
              name: '김철수반',
              instructor_id: 1,
              instructor_name: '김철수',
              order_num: 1,
              members: [],
            },
          ],
        },
      ],
    };

    const instructorsData = {
      instructors: [
        { id: 1, name: '김철수' },
      ],
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/presets/instructors')) {
        return Promise.resolve({ data: instructorsData });
      }
      if (url.includes('/presets')) {
        return Promise.resolve({ data: presetsData });
      }
      if (url.includes('/students')) {
        return Promise.resolve({ data: { students: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    mockPut.mockResolvedValue({ data: {} });

    const PresetsPage = (await import('@/app/(pc)/presets/page')).default;
    render(<PresetsPage />);

    // 프리셋 로딩 대기
    await waitFor(() => {
      expect(screen.getByText('김철수반')).toBeInTheDocument();
    });

    // 강사 선택 드롭다운 열기
    const instructorButton = screen.getByText('김철수');
    fireEvent.click(instructorButton);

    // "선택 안 함" 클릭
    await waitFor(() => {
      expect(screen.getByText('선택 안 함')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('선택 안 함'));

    // API가 instructor_id: null 로 호출, name 필드 없어야 함
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/presets/groups/10',
        { instructor_id: null }
      );
    });
  });
});

// Custom matcher
expect.extend({
  toEndWith(received: string, suffix: string) {
    const pass = received.endsWith(suffix);
    return {
      pass,
      message: () => `expected "${received}" to end with "${suffix}"`,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEndWith(suffix: string): R;
    }
  }
}
