const crypto = require('crypto');

class PeakSsoError extends Error {
  constructor(code, message = '피크 자동 로그인 시간이 만료되었습니다. P-ACA에서 다시 열어주세요.') {
    super(message);
    this.name = 'PeakSsoError';
    this.code = code;
    this.publicMessage = message;
  }
}

function hashPeakSsoCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function assertCodeFormat(code) {
  if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) {
    throw new PeakSsoError('INVALID_SSO_CODE');
  }
}

async function exchangePeakSsoCode(pacaPool, code) {
  assertCodeFormat(code);
  const codeHash = hashPeakSsoCode(code);

  const [rows] = await pacaPool.query(
    `SELECT c.id AS code_id, c.user_id, c.academy_id,
            u.email, u.name, u.role, u.is_active, u.approval_status, u.position, u.instructor_id
     FROM peak_sso_codes c
     JOIN users u ON u.id = c.user_id
     WHERE c.code_hash = ?
       AND c.used_at IS NULL
       AND c.expires_at > NOW()
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [codeHash]
  );

  const user = rows[0];
  if (!user) {
    throw new PeakSsoError('INVALID_SSO_CODE');
  }
  if (!user.is_active || user.approval_status !== 'approved') {
    throw new PeakSsoError('PACA_USER_BLOCKED', '계정 상태를 확인하지 못했습니다. 관리자에게 문의하세요.');
  }

  const [updated] = await pacaPool.query(
    `UPDATE peak_sso_codes
     SET used_at = NOW()
     WHERE id = ? AND used_at IS NULL`,
    [user.code_id]
  );

  if (!updated.affectedRows) {
    throw new PeakSsoError('SSO_CODE_ALREADY_USED');
  }

  return user;
}

module.exports = {
  PeakSsoError,
  exchangePeakSsoCode,
  hashPeakSsoCode,
};
