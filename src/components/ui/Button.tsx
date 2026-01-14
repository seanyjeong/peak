'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: 'bg-brand-orange text-white hover:bg-brand-orange-dark active:scale-95 shadow-sm hover:shadow-md',
  secondary: 'bg-muted text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-95',
  danger: 'bg-error text-white hover:bg-error-light active:scale-95 shadow-sm',
  ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95',
  outline: 'bg-transparent border border-border text-foreground hover:bg-muted active:scale-95',
  success: 'bg-success text-white hover:bg-success-light active:scale-95 shadow-sm',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm rounded-lg min-h-[36px]',
  md: 'px-4 py-2.5 text-sm rounded-xl min-h-[40px]',
  lg: 'px-6 py-3 text-base rounded-xl min-h-[44px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
