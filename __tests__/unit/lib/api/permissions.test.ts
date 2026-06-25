import {
  getFallbackFeaturePermissions,
  isAdminUser,
} from '@/lib/api/permissions';

describe('feature permission API helpers', () => {
  it('treats owner and admin as the same manager role', () => {
    expect(isAdminUser({ role: 'owner' })).toBe(true);
    expect(isAdminUser({ role: 'admin' })).toBe(true);
    expect(isAdminUser({ role: 'staff' })).toBe(false);
  });

  it('keeps manager fallback permissions open and staff fallback permissions closed', () => {
    expect(getFallbackFeaturePermissions({ role: 'owner' })).toEqual({
      analyticsReport: true,
      measurementSettingsManage: true,
      canManagePermissions: true,
    });
    expect(getFallbackFeaturePermissions({ role: 'staff' })).toEqual({
      analyticsReport: false,
      measurementSettingsManage: false,
      canManagePermissions: false,
    });
  });
});
