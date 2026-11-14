'use client';

import { chipClass } from '@/components/ui/page';

// P-ACA 지점 고르기. 지점이 없는 학원은 아무것도 그리지 않는다. null = 전체.
export interface Branch {
  id: number;
  name: string;
}

export function BranchTabs({
  branches,
  value,
  onChange,
}: {
  branches: Branch[];
  value: number | null;
  onChange: (branchId: number | null) => void;
}) {
  if (branches.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="지점">
      {[{ id: null, name: '전체' }, ...branches].map((branch) => (
        <button
          key={branch.id ?? 'all'}
          type="button"
          aria-pressed={value === branch.id}
          onClick={() => onChange(branch.id)}
          className={chipClass(value === branch.id)}
        >
          {branch.name}
        </button>
      ))}
    </div>
  );
}
