/**
 * Modal Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Modal, ModalFooter } from '@/components/ui/Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('should render title when provided', () => {
      render(<Modal {...defaultProps} title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should render footer when provided', () => {
      render(<Modal {...defaultProps} footer={<button>Footer Button</button>} />);
      expect(screen.getByRole('button', { name: 'Footer Button' })).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('should call onClose when close button is clicked', () => {
      render(<Modal {...defaultProps} title="Title" />);
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      render(<Modal {...defaultProps} />);
      const overlay = document.querySelector('.bg-black\\/50');
      fireEvent.click(overlay!);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when closeOnOverlayClick is false', () => {
      render(<Modal {...defaultProps} closeOnOverlayClick={false} />);
      const overlay = document.querySelector('.bg-black\\/50');
      fireEvent.click(overlay!);
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      render(<Modal {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when Escape is pressed and closeOnEscape is false', () => {
      render(<Modal {...defaultProps} closeOnEscape={false} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('sizes', () => {
    it('should apply small size class', () => {
      render(<Modal {...defaultProps} size="sm" />);
      expect(document.querySelector('.max-w-sm')).toBeInTheDocument();
    });

    it('should apply large size class', () => {
      render(<Modal {...defaultProps} size="lg" />);
      expect(document.querySelector('.max-w-lg')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have dialog role', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });
  });
});

describe('ModalFooter', () => {
  it('should render cancel button when onCancel is provided', () => {
    const onCancel = jest.fn();
    render(<ModalFooter onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('should render confirm button when onConfirm is provided', () => {
    const onConfirm = jest.fn();
    render(<ModalFooter onConfirm={onConfirm} />);
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = jest.fn();
    render(<ModalFooter onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should use custom button texts', () => {
    render(
      <ModalFooter
        onCancel={() => {}}
        onConfirm={() => {}}
        cancelText="닫기"
        confirmText="저장"
      />
    );
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});
