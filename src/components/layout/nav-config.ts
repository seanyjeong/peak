import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Activity,
  Medal,
  UserCheck,
  ListChecks,
  Layers,
  Settings,
  Trophy,
  BarChart3,
  TableProperties,
  type LucideIcon,
} from 'lucide-react';
import type { FeaturePermissions } from '@/lib/api/permissions';

export type NavigationPermission = 'analyticsReport' | 'measurementSettingsManage';

export interface NavItem {
  name: string;
  /** PC 주소. 태블릿은 앞에 /tablet 을 붙여 쓴다. */
  href: string;
  icon: LucideIcon;
  permission?: NavigationPermission;
  /** 태블릿 메뉴에만 있는 항목 */
  tabletOnly?: boolean;
}

export interface NavCategory {
  title: string;
  items: NavItem[];
}

export const dashboardItem: NavItem = { name: '대시보드', href: '/dashboard', icon: LayoutDashboard };

// 사이드바·아래 탭의 '전체' 메뉴가 함께 쓰는 메뉴 구조
export const navCategories: NavCategory[] = [
  {
    title: '수업 운영',
    items: [
      { name: '출근 체크', href: '/attendance', icon: UserCheck },
      { name: '학생 출석', href: '/student-attendance', icon: ListChecks },
      { name: '반 배치', href: '/assignments', icon: Users },
      { name: '반 프리셋', href: '/presets', icon: Layers },
      { name: '수업 계획', href: '/plans', icon: ClipboardList },
      { name: '수업 기록', href: '/training', icon: Activity },
    ],
  },
  {
    title: '학생·기록',
    items: [
      { name: '학생 관리', href: '/students', icon: Calendar },
      { name: '기록 측정', href: '/records', icon: Medal },
      { name: '월말테스트', href: '/monthly-test', icon: Trophy },
      { name: '분석 리포트', href: '/analytics', icon: BarChart3, permission: 'analyticsReport' },
    ],
  },
  {
    title: '관리',
    items: [
      { name: '배점표', href: '/score-table', icon: TableProperties, permission: 'measurementSettingsManage', tabletOnly: true },
      { name: '실기 측정 설정', href: '/settings', icon: Settings, permission: 'measurementSettingsManage' },
    ],
  },
];

// 휴대폰 폭 아래 탭 (자주 쓰는 4개, 나머지는 '전체'에서)
export const phoneTabs: NavItem[] = [
  dashboardItem,
  { name: '반 배치', href: '/assignments', icon: Users },
  { name: '기록 측정', href: '/records', icon: Medal },
  { name: '학생', href: '/students', icon: Calendar },
];

// 태블릿 세로 아래 탭 (기존 태블릿과 같은 5개)
export const tabletTabs: NavItem[] = [
  dashboardItem,
  { name: '반 배치', href: '/assignments', icon: Users },
  { name: '반 프리셋', href: '/presets', icon: Layers },
  { name: '수업 기록', href: '/training', icon: Activity },
  { name: '기록 측정', href: '/records', icon: Medal },
];

export function canShowNavItem(
  item: NavItem,
  permissions: FeaturePermissions | null,
  fallback: FeaturePermissions,
  tablet: boolean,
): boolean {
  if (item.tabletOnly && !tablet) return false;
  if (!item.permission) return true;
  return permissions?.[item.permission] ?? fallback[item.permission];
}

export function withPrefix(href: string, prefix: string): string {
  return `${prefix}${href}`;
}

// 지금 주소에 가장 길게 맞는 메뉴 하나만 선택 표시한다.
export function findActiveHref(pathname: string, prefix: string): string | null {
  const hrefs = [dashboardItem, ...navCategories.flatMap((category) => category.items)].map((item) => withPrefix(item.href, prefix));
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

export const getRoleDisplayName = (role?: string, position?: string | null): string => {
  if (position) return position;
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};
