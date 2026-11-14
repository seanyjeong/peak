'use client';

import { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-secondary-foreground mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full px-4 py-2 rounded-xl border transition appearance-none bg-card
              text-foreground
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
              disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
              pr-10
              ${error ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : 'border-border'}
              ${className}
            `}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${selectId}-helper`} className="mt-1 text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Native date input styled as Select
export interface DateInputProps extends Omit<SelectHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || `date-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-secondary-foreground mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="date"
          id={inputId}
          className={`
            w-full px-4 py-2 rounded-xl border transition
            bg-card text-foreground
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
            ${error ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : 'border-border'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';

export { Select, DateInput };
