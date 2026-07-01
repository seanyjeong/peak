import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  BoardSettingsModal,
  type SlugCheckState,
} from '@/app/(pc)/monthly-test/board-settings-modal';

const baseSlugCheck: SlugCheckState = { status: 'idle', message: '' };

function renderModal(overrides: Partial<ComponentProps<typeof BoardSettingsModal>> = {}) {
  const props: ComponentProps<typeof BoardSettingsModal> = {
    clearBoardPin: false,
    currentSlug: 'ilsanmax',
    hasBoardPin: true,
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
});
