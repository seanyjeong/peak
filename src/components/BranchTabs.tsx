'use client';

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
          className={`inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition ${
            value === branch.id
              ? 'border-primary bg-primary-soft text-primary shadow-sm'
              : 'border-border bg-card text-secondary-foreground hover:bg-muted'
          }`}
        >
          {branch.name}
        </button>
      ))}
    </div>
  );
}
