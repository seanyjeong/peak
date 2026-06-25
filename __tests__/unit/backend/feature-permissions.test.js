const {
  FEATURE_PERMISSION_DEFAULTS,
  FeaturePermissionStoreNotReadyError,
  createFeaturePermissionMiddleware,
  getEffectiveFeaturePermissions,
  normalizeFeaturePermissionPayload,
  saveAcademyFeaturePermissions,
} = require('../../../backend/utils/feature-permissions');

function createDb(rows = []) {
  return {
    queries: [],
    query: jest.fn(async (sql) => {
      if (sql.includes('SELECT allow_staff_analytics_report')) {
        return [rows];
      }
      if (sql.includes('INSERT INTO academy_feature_permissions')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }),
  };
}

function createResponse() {
  return {
    body: null,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('feature permissions', () => {
  it('keeps owner and admin fully enabled regardless of stored staff settings', async () => {
    const db = createDb([{
      allow_staff_analytics_report: 0,
      allow_staff_measurement_settings: 0,
    }]);

    await expect(getEffectiveFeaturePermissions(db, {
      role: 'owner',
      academyId: 2,
    })).resolves.toEqual({
      analyticsReport: true,
      measurementSettingsManage: true,
      canManagePermissions: true,
    });

    await expect(getEffectiveFeaturePermissions(db, {
      role: 'admin',
      academyId: 2,
    })).resolves.toMatchObject({
      analyticsReport: true,
      measurementSettingsManage: true,
      canManagePermissions: true,
    });
  });

  it('defaults staff permissions to closed until an academy grants them', async () => {
    const db = createDb([]);

    await expect(getEffectiveFeaturePermissions(db, {
      role: 'staff',
      academyId: 2,
    })).resolves.toEqual({
      ...FEATURE_PERMISSION_DEFAULTS,
      canManagePermissions: false,
    });
  });

  it('enables staff only for granted feature switches', async () => {
    const db = createDb([{
      allow_staff_analytics_report: 1,
      allow_staff_measurement_settings: 0,
    }]);

    await expect(getEffectiveFeaturePermissions(db, {
      role: 'staff',
      academyId: 2,
    })).resolves.toEqual({
      analyticsReport: true,
      measurementSettingsManage: false,
      canManagePermissions: false,
    });
  });

  it('normalizes only supported permission switches from request payloads', () => {
    expect(normalizeFeaturePermissionPayload({
      analyticsReport: true,
      measurementSettingsManage: false,
      canManagePermissions: true,
      unexpected: true,
    })).toEqual({
      analyticsReport: true,
      measurementSettingsManage: false,
    });
  });

  it('stores academy permissions with a scoped upsert', async () => {
    const db = createDb();

    await saveAcademyFeaturePermissions(db, 7, {
      analyticsReport: true,
      measurementSettingsManage: false,
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO academy_feature_permissions'),
      [7, 1, 0]
    );
  });

  it('returns Korean forbidden copy from protected feature middleware', async () => {
    const db = createDb([]);
    const middleware = createFeaturePermissionMiddleware(db, 'analyticsReport');
    const req = { user: { role: 'staff', academyId: 2 } };
    const res = createResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'FORBIDDEN',
      message: '이 기능을 사용할 권한이 없습니다. 원장에게 권한을 요청해주세요.',
    });
  });

  it('does not block owner when the permission table is not ready yet', async () => {
    const db = {
      query: jest.fn(async () => {
        throw new FeaturePermissionStoreNotReadyError();
      }),
    };

    await expect(getEffectiveFeaturePermissions(db, {
      role: 'owner',
      academyId: 2,
    })).resolves.toEqual({
      analyticsReport: true,
      measurementSettingsManage: true,
      canManagePermissions: true,
    });
  });
});
