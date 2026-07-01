import { fireEvent, render, screen } from '@testing-library/react';
import { BoardPinGate } from '@/app/board/[slug]/board-pin-gate';

describe('BoardPinGate', () => {
  it('shows Korean plain-language PIN guidance and errors', () => {
    render(
      <BoardPinGate
        academyName="일산맥스"
        error="PIN이 올바르지 않습니다."
        onPinChange={jest.fn()}
        onSubmit={jest.fn((event) => event.preventDefault())}
        pin=""
        submitting={false}
      />
    );

    expect(screen.getByText('일산맥스')).toBeInTheDocument();
    expect(screen.getByText('PIN 확인 후 전광판을 볼 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByText('PIN이 올바르지 않습니다.')).toBeInTheDocument();
  });

  it('filters PIN input to numeric digits', () => {
    const onPinChange = jest.fn();
    render(
      <BoardPinGate
        error={null}
        onPinChange={onPinChange}
        onSubmit={jest.fn((event) => event.preventDefault())}
        pin=""
        submitting={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('숫자 4~12자리'), {
      target: { value: '12ab34' },
    });

    expect(onPinChange).toHaveBeenCalledWith('1234');
  });
});
