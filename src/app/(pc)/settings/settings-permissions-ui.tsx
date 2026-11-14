import { BarChart3, Save, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AcademyFeaturePermissions } from '@/lib/api/permissions';

interface PermissionItem {
  key: keyof AcademyFeaturePermissions;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  {
    key: 'analyticsReport',
    title: '분석 리포트',
    description: '강사가 학원 전체 분석 리포트를 볼 수 있습니다.',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    key: 'measurementSettingsManage',
    title: '실기 측정 설정',
    description: '강사가 측정 종목과 배점표를 추가하거나 수정할 수 있습니다.',
    icon: <Settings className="h-4 w-4" />,
  },
];

export function PermissionsPanel({
  permissions,
  saving,
  onSave,
  onToggle,
}: {
  permissions: AcademyFeaturePermissions;
  saving: boolean;
  onSave: () => void;
  onToggle: (key: keyof AcademyFeaturePermissions) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">권한 관리</h2>
          <p className="mt-1 text-sm text-muted-foreground">원장과 관리자는 항상 모든 기능을 사용할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background transition hover:bg-foreground/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? '저장 중' : '저장'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card">
        <div className="divide-y divide-border">
          {PERMISSION_ITEMS.map((item) => {
            const enabled = permissions[item.key];
            return (
              <div key={item.key} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-muted p-2 text-secondary-foreground">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`${item.title} 강사 권한 ${enabled ? '끄기' : '켜기'}`}
                  aria-pressed={enabled}
                  onClick={() => onToggle(item.key)}
                  className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                    enabled
                      ? 'bg-success-soft text-success hover:bg-success-soft'
                      : 'bg-muted text-muted-foreground hover:bg-border'
                  }`}
                >
                  {enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {enabled ? '강사 허용' : '원장만'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
