import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  BoardSettingsModal,
  type SlugCheckState,
} from '@/app/(pc)/monthly-test/board-settings-modal';

const baseSlugCheck: SlugCheckState = { status: 'idle', message: '' };

function renderModal(overrides: Partial<ComponentProps<typeof BoardSettingsModal>> = {}) {
  const props: ComponentProps<typeof BoardSettingsModal> = {
    academyName: '일산',
    boardTheme: 1,
    clearBoardPin: false,
    currentSlug: 'ilsanmax',
    hasBoardPin: true,
    onBoardThemeChange: jest.fn(),
    onCheckSlug: jest.fn(),
    onClearBoardPinChange: jest.fn(),
    onClose: jest.fn(),
    onPinChange: jest.fn(),
    onSave: jest.fn(),
    open: true,
    pinInput: '',
    saving: false,
    slugCheck: baseSlugCheck,
    slugInput: 'ilsanmax',
    setSlugInput: jest.fn(),
    ...overrides,
  };
  render(<BoardSettingsModal {...props} />);
  return props;
}

describe('BoardSettingsModal', () => {
  it('shows duplicate check and board PIN controls', () => {
    renderModal();

    expect(screen.getByText('중복확인')).toBeInTheDocument();
    expect(screen.getByText('전광판 PIN')).toBeInTheDocument();
    expect(screen.getByText('PIN 해제')).toBeInTheDocument();
    expect(screen.getByText(/\/board\/ilsanmax$/)).toBeInTheDocument();
  });

  it('sanitizes PIN input to numeric 12 digits before notifying parent', () => {
    const onPinChange = jest.fn();
    renderModal({ onPinChange });

    fireEvent.change(screen.getByPlaceholderText('새 PIN 입력 시 변경됩니다'), {
      target: { value: '12ab345678901234' },
    });

    expect(onPinChange).toHaveBeenCalledWith('123456789012');
  });

  it('shows Korean duplicate check feedback', () => {
    renderModal({
      slugCheck: {
        status: 'taken',
        message: '이미 다른 학원에서 사용 중인 전광판 주소입니다.',
      },
    });

    expect(screen.getByText('이미 다른 학원에서 사용 중인 전광판 주소입니다.')).toBeInTheDocument();
  });

  it('shows five board themes with previews and reports the picked theme', () => {
    const onBoardThemeChange = jest.fn();
    renderModal({ boardTheme: 2, onBoardThemeChange });

    const options = screen.getAllByRole('radio');
    expect(options.map((option) => option.textContent?.includes('스포츠 중계') || option.textContent?.includes('경기장 LED') || option.textContent?.includes('밝고 깔끔') || option.textContent?.includes('시상대') || option.textContent?.includes('육상 트랙'))).toEqual([true, true, true, true, true]);
    expect(options[1]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/경기장 LED · 검은 바탕에 LED 글씨/)).toBeInTheDocument();
    // 큰 미리보기 1개 + 테마 칸 5개, 모두 예시 학생으로 그린다
    expect(screen.getAllByText('김도윤')).toHaveLength(6);
    expect(screen.getByText('실제 전광판으로 미리보기')).toHaveAttribute('href', '/board/ilsanmax?theme=2');

    fireEvent.click(options[3]);
    expect(onBoardThemeChange).toHaveBeenCalledWith(4);
  });
});
