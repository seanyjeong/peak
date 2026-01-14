'use client';

import { ReactNode, forwardRef, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const variantStyles = {
  default: 'bg-surface-base border border-border',
  outlined: 'bg-transparent border border-border',
  elevated: 'bg-surface-base border border-border shadow-elevated',
  glass: 'glass-card',
  bento: 'bento-card hover-lift',
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
          rounded-xl transition-smooth
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hoverable ? 'hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600 cursor-pointer' : ''}
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
    <div className={`pb-4 border-b border-border mb-4 ${className}`}>
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
    <h3 className={`font-semibold text-foreground text-base tracking-tight ${className}`}>
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
    <div className={`pt-4 border-t border-border mt-4 ${className}`}>
      {children}
    </div>
  );
}

export { Card };
