import apiClient from './client';
import type { User } from './auth';

export interface FeaturePermissions {
  analyticsReport: boolean;
  measurementSettingsManage: boolean;
  canManagePermissions: boolean;
}

export interface AcademyFeaturePermissions {
  analyticsReport: boolean;
  measurementSettingsManage: boolean;
}

interface PermissionsResponse<T> {
  success: boolean;
  permissions: T;
}

export function isAdminUser(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'owner' || user?.role === 'admin';
}

export function getFallbackFeaturePermissions(user: Pick<User, 'role'> | null | undefined): FeaturePermissions {
  const admin = isAdminUser(user);
  return {
    analyticsReport: admin,
    measurementSettingsManage: admin,
    canManagePermissions: admin,
  };
}

export async function getMyFeaturePermissions(user: User): Promise<FeaturePermissions> {
  try {
    const { data } = await apiClient.get<PermissionsResponse<FeaturePermissions>>('/permissions/me');
    return data.permissions || getFallbackFeaturePermissions(user);
  } catch {
    return getFallbackFeaturePermissions(user);
  }
}

export const permissionsAPI = {
  async getAcademy(): Promise<AcademyFeaturePermissions> {
    const { data } = await apiClient.get<PermissionsResponse<AcademyFeaturePermissions>>('/permissions');
    return data.permissions;
  },

  async updateAcademy(permissions: AcademyFeaturePermissions): Promise<AcademyFeaturePermissions> {
    const { data } = await apiClient.put<PermissionsResponse<AcademyFeaturePermissions>>('/permissions', permissions);
    return data.permissions;
  },
};
