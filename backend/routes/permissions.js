const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  FeaturePermissionStoreNotReadyError,
  getEffectiveFeaturePermissions,
  loadAcademyFeaturePermissions,
  requireAdminRole,
  saveAcademyFeaturePermissions,
} = require('../utils/feature-permissions');

router.get('/me', async (req, res) => {
  try {
    const permissions = await getEffectiveFeaturePermissions(db, req.user);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: '권한 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

router.get('/', requireAdminRole, async (req, res) => {
  try {
    const permissions = await loadAcademyFeaturePermissions(db, req.user.academyId);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Get academy permissions error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: '권한 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

router.put('/', requireAdminRole, async (req, res) => {
  try {
    const permissions = await saveAcademyFeaturePermissions(db, req.user.academyId, req.body);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Save academy permissions error:', error);
    if (error instanceof FeaturePermissionStoreNotReadyError) {
      return res.status(503).json({
        error: 'STORE_NOT_READY',
        message: '권한 설정 저장소가 아직 준비되지 않았습니다. 관리자에게 문의해주세요.',
      });
    }
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: '권한 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

module.exports = router;
