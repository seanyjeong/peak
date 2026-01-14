'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gradient' | 'glass' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-sm hover:shadow-md transition-all duration-200',
  secondary: 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all duration-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm hover:shadow-md transition-all duration-200',
  ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all duration-200',
  outline: 'bg-transparent border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all duration-200',
  gradient: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:scale-95 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all duration-200',
  glass: 'bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-white hover:bg-slate-800/50 hover:border-slate-700 active:scale-95 transition-all duration-200',
  success: 'bg-green-500 text-white hover:bg-green-600 active:scale-95 shadow-sm hover:shadow-md transition-all duration-200',
  warning: 'bg-yellow-500 text-white hover:bg-yellow-600 active:scale-95 shadow-sm hover:shadow-md transition-all duration-200',
};

const sizeStyles = {
  xs: 'px-2.5 py-1.5 text-xs rounded-lg min-h-[28px] gap-1.5',
  sm: 'px-3 py-2 text-sm rounded-lg min-h-[36px] gap-2',
  md: 'px-4 py-2.5 text-sm rounded-xl min-h-[40px] gap-2',
  lg: 'px-6 py-3 text-base rounded-xl min-h-[44px] gap-2.5',
  xl: 'px-8 py-4 text-lg rounded-xl min-h-[52px] gap-3',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
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
          inline-flex items-center justify-center
          font-medium
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };