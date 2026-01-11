'use client';

import { ReactNode, createContext, useContext, useState } from 'react';

// Context for Tabs
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

// Main Tabs container
export interface TabsProps {
  children: ReactNode;
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({
  children,
  defaultValue,
  value,
  onValueChange,
  className = '',
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (tab: string) => {
    if (onValueChange) {
      onValueChange(tab);
    } else {
      setInternalValue(tab);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// Tab list container
export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div
      className={`flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

// Individual tab trigger
export interface TabsTriggerProps {
  children: ReactNode;
  value: string;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({
  children,
  value,
  disabled = false,
  className = '',
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={`
        flex-1 px-4 py-2 text-sm font-medium rounded-lg transition
        ${
          isActive
            ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// Tab content panel
export interface TabsContentProps {
  children: ReactNode;
  value: string;
  className?: string;
}

export function TabsContent({ children, value, className = '' }: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div role="tabpanel" className={`mt-4 ${className}`}>
      {children}
    </div>
  );
}

// Simple inline tabs (without context)
export interface SimpleTabsProps {
  tabs: { value: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SimpleTabs({ tabs, activeTab, onChange, className = '' }: SimpleTabsProps) {
  return (
    <div className={`flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`
            flex-1 px-4 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2
            ${
              activeTab === tab.value
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700'
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`
                px-1.5 py-0.5 text-xs rounded-full
                ${activeTab === tab.value ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
              `}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
