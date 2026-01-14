'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode, ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    asChild
    {...props}
  >
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm ${className}`}
    />
  </DialogPrimitive.Overlay>
));
DialogOverlay.displayName = 'DialogOverlay';

interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
}

const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className = '', children, size = 'md', showClose = true, ...props }, ref) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        asChild
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{
            type: 'spring' as const,
            stiffness: 300,
            damping: 30,
          }}
          className={`
            fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2
            ${sizeClasses[size]}
            glass-card rounded-2xl shadow-floating
            max-h-[90vh] overflow-hidden flex flex-col
            ${className}
          `}
        >
          {children}
          {showClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <X size={18} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className = '', children, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={`flex flex-col space-y-1.5 px-6 py-4 border-b border-border ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogTitle({ className = '', ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={`text-lg font-semibold leading-none tracking-tight text-foreground ${className}`}
      {...props}
    />
  );
}

function DialogDescription({ className = '', ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={`text-sm text-muted-foreground ${className}`}
      {...props}
    />
  );
}

function DialogBody({ className = '', children, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={`flex-1 overflow-y-auto px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

function DialogFooter({ className = '', ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-border ${className}`}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
};