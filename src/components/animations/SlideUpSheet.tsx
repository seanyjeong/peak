'use client';

import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideUpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function SlideUpSheet({ isOpen, onClose, children, title }: SlideUpSheetProps) {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [0.5, 0]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    // Close if dragged down more than 100px or velocity is high
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
            style={{ opacity }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring' as const,
              stiffness: 300,
              damping: 30,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-800 rounded-t-2xl shadow-floating max-h-[85vh] flex flex-col"
          >
            {/* Drag Handle */}
            <div className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-4 border-b border-border">
              {title && (
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-auto"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 safe-area-pb">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}