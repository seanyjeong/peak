'use client';

import { usePathname } from 'next/navigation';

export type DeviceType = 'pc' | 'tablet' | 'mobile';

/**
 * 현재 경로 기반으로 디바이스 타입을 반환합니다.
 * - /tablet/* → 'tablet'
 * - /mobile/* → 'mobile'
 * - 그 외 → 'pc'
 */
export function useDeviceType(): DeviceType {
  const pathname = usePathname();

  if (pathname?.startsWith('/tablet')) {
    return 'tablet';
  }

  if (pathname?.startsWith('/mobile')) {
    return 'mobile';
  }

  return 'pc';
}

/**
 * 디바이스 타입에 따른 조건부 값 반환
 */
export function useDeviceValue<T>(values: {
  pc: T;
  tablet?: T;
  mobile?: T;
}): T {
  const deviceType = useDeviceType();

  if (deviceType === 'tablet' && values.tablet !== undefined) {
    return values.tablet;
  }

  if (deviceType === 'mobile' && values.mobile !== undefined) {
    return values.mobile;
  }

  return values.pc;
}
