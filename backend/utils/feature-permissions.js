const FEATURE_PERMISSION_DEFAULTS = Object.freeze({
  analyticsReport: false,
  measurementSettingsManage: false,
});

const FEATURE_COLUMNS = Object.freeze({
  analyticsReport: 'allow_staff_analytics_report',
  measurementSettingsManage: 'allow_staff_measurement_settings',
});

const ADMIN_ROLES = new Set(['owner', 'admin']);

class FeaturePermissionStoreNotReadyError extends Error {
  constructor() {
    super('Feature permission store is not ready');
    this.name = 'FeaturePermissionStoreNotReadyError';
  }
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

function toFlag(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function isStoreNotReadyError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

function normalizeStoredPermissions(row) {
  if (!row) return { ...FEATURE_PERMISSION_DEFAULTS };
  return {
    analyticsReport: toBoolean(row.allow_staff_analytics_report),
    measurementSettingsManage: toBoolean(row.allow_staff_measurement_settings),
  };
}

function normalizeFeaturePermissionPayload(payload = {}) {
  return {
    analyticsReport: toBoolean(payload.analyticsReport),
    measurementSettingsManage: toBoolean(payload.measurementSettingsManage),
  };
}

async function loadAcademyFeaturePermissions(db, academyId) {
  try {
    const [rows] = await db.query(
      `SELECT allow_staff_analytics_report, allow_staff_measurement_settings
       FROM academy_feature_permissions
       WHERE academy_id = ?`,
      [academyId]
    );
    return normalizeStoredPermissions(rows[0]);
  } catch (error) {
    if (isStoreNotReadyError(error)) {
      return { ...FEATURE_PERMISSION_DEFAULTS };
    }
    throw error;
  }
}

async function getEffectiveFeaturePermissions(db, user) {
  if (isAdminRole(user?.role)) {
    return {
      analyticsReport: true,
      measurementSettingsManage: true,
      canManagePermissions: true,
    };
  }

  const stored = user?.academyId
    ? await loadAcademyFeaturePermissions(db, user.academyId)
    : { ...FEATURE_PERMISSION_DEFAULTS };

  return {
    ...stored,
    canManagePermissions: false,
  };
}

async function saveAcademyFeaturePermissions(db, academyId, payload) {
  const permissions = normalizeFeaturePermissionPayload(payload);
  try {
    await db.query(
      `INSERT INTO academy_feature_permissions
       (academy_id, allow_staff_analytics_report, allow_staff_measurement_settings)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         allow_staff_analytics_report = VALUES(allow_staff_analytics_report),
         allow_staff_measurement_settings = VALUES(allow_staff_measurement_settings)`,
      [
        academyId,
        toFlag(permissions.analyticsReport),
        toFlag(permissions.measurementSettingsManage),
      ]
    );
    return permissions;
  } catch (error) {
    if (isStoreNotReadyError(error)) {
      throw new FeaturePermissionStoreNotReadyError();
    }
    throw error;
  }
}

function forbidden(res) {
  return res.status(403).json({
    error: 'FORBIDDEN',
    message: '이 기능을 사용할 권한이 없습니다. 원장에게 권한을 요청해주세요.',
  });
}

function createFeaturePermissionMiddleware(db, feature) {
  if (!FEATURE_COLUMNS[feature]) {
    throw new Error(`Unknown feature permission: ${feature}`);
  }

  return async (req, res, next) => {
    try {
      const permissions = await getEffectiveFeaturePermissions(db, req.user);
      if (permissions[feature]) return next();
      return forbidden(res);
    } catch (error) {
      console.error('Feature permission check error:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: '권한 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
      });
    }
  };
}

function requireFeaturePermission(feature) {
  const db = require('../config/database');
  return createFeaturePermissionMiddleware(db, feature);
}

function requireAdminRole(req, res, next) {
  if (isAdminRole(req.user?.role)) return next();
  return forbidden(res);
}

module.exports = {
  FEATURE_PERMISSION_DEFAULTS,
  FeaturePermissionStoreNotReadyError,
  createFeaturePermissionMiddleware,
  getEffectiveFeaturePermissions,
  isAdminRole,
  loadAcademyFeaturePermissions,
  normalizeFeaturePermissionPayload,
  requireAdminRole,
  requireFeaturePermission,
  saveAcademyFeaturePermissions,
};
