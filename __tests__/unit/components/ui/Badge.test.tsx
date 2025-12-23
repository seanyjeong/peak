/**
 * Badge Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Badge, GenderBadge, StatusBadge, TrialBadge } from '@/components/ui/Badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('should render children correctly', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should apply default variant styles', () => {
      render(<Badge variant="default">Default</Badge>);
      expect(screen.getByText('Default')).toHaveClass('bg-slate-100');
    });

    it('should apply success variant styles', () => {
      render(<Badge variant="success">Success</Badge>);
      expect(screen.getByText('Success')).toHaveClass('bg-green-100');
    });

    it('should apply warning variant styles', () => {
      render(<Badge variant="warning">Warning</Badge>);
      expect(screen.getByText('Warning')).toHaveClass('bg-amber-100');
    });

    it('should apply danger variant styles', () => {
      render(<Badge variant="danger">Danger</Badge>);
      expect(screen.getByText('Danger')).toHaveClass('bg-red-100');
    });

    it('should apply purple variant styles', () => {
      render(<Badge variant="purple">Purple</Badge>);
      expect(screen.getByText('Purple')).toHaveClass('bg-purple-100');
    });
  });

  describe('sizes', () => {
    it('should apply extra small size', () => {
      render(<Badge size="xs">XS</Badge>);
      expect(screen.getByText('XS')).toHaveClass('text-[9px]');
    });

    it('should apply small size', () => {
      render(<Badge size="sm">SM</Badge>);
      expect(screen.getByText('SM')).toHaveClass('text-[10px]');
    });

    it('should apply medium size', () => {
      render(<Badge size="md">MD</Badge>);
      expect(screen.getByText('MD')).toHaveClass('text-xs');
    });
  });
});

describe('GenderBadge', () => {
  it('should render male badge correctly', () => {
    render(<GenderBadge gender="M" />);
    expect(screen.getByText('남')).toBeInTheDocument();
    expect(screen.getByText('남')).toHaveClass('bg-blue-100');
  });

  it('should render female badge correctly', () => {
    render(<GenderBadge gender="F" />);
    expect(screen.getByText('여')).toBeInTheDocument();
    expect(screen.getByText('여')).toHaveClass('bg-pink-100');
  });
});

describe('StatusBadge', () => {
  it('should render enrolled status', () => {
    render(<StatusBadge status="enrolled" />);
    expect(screen.getByText('등록')).toBeInTheDocument();
    expect(screen.getByText('등록')).toHaveClass('bg-green-100');
  });

  it('should render trial status', () => {
    render(<StatusBadge status="trial" />);
    expect(screen.getByText('체험')).toBeInTheDocument();
    expect(screen.getByText('체험')).toHaveClass('bg-purple-100');
  });

  it('should render rest status', () => {
    render(<StatusBadge status="rest" />);
    expect(screen.getByText('휴원')).toBeInTheDocument();
    expect(screen.getByText('휴원')).toHaveClass('bg-amber-100');
  });

  it('should render injury status', () => {
    render(<StatusBadge status="injury" />);
    expect(screen.getByText('부상')).toBeInTheDocument();
    expect(screen.getByText('부상')).toHaveClass('bg-red-100');
  });
});

describe('TrialBadge', () => {
  it('should render trial progress correctly', () => {
    render(<TrialBadge completed={1} total={3} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toHaveClass('bg-purple-100');
  });
});
