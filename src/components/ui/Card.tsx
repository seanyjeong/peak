'use client';

import { ReactNode, forwardRef, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const variantStyles = {
  default: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
  outlined: 'bg-transparent border border-slate-300 dark:border-slate-600',
  elevated: 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      hoverable = false,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-xl transition
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hoverable ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`pb-4 border-b border-slate-200 dark:border-slate-700 mb-6 ${className}`}>
      {children}
    </div>
  );
}

// Card Title
export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`font-semibold text-slate-900 dark:text-slate-100 text-base tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

// Card Content
export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

// Card Footer
export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`pt-4 border-t border-slate-200 dark:border-slate-700 mt-6 ${className}`}>
      {children}
    </div>
  );
}

export { Card };
