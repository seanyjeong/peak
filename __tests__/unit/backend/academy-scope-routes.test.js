const fs = require('fs');
const path = require('path');

function source(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, ' ');
}

describe('academy scoped route SQL', () => {
  const monthlyTests = compact(source('backend/routes/monthlyTests.js'));
  const testSessions = compact(source('backend/routes/testSessions.js'));
  const testApplicants = compact(source('backend/routes/testApplicants.js'));
  const publicBoard = compact(source('backend/routes/publicBoard.js'));
  const peakSettings = source('backend/routes/peakSettings.js');
  const analytics = source('backend/routes/analytics.js');
  const recordTypes = source('backend/routes/recordTypes.js');
  const scoreTable = source('backend/routes/scoreTable.js');
  const push = compact(source('backend/routes/push.js'));

  it('creates monthly test sessions with the current academy id', () => {
    expect(monthlyTests).toContain(
      'INSERT INTO test_sessions (academy_id, monthly_test_id, test_date, time_slot, notes)'
    );
  });

  it('creates test session students, groups, participants, and test records with academy id', () => {
    expect(testSessions).toContain(
      'INSERT INTO students (academy_id, paca_student_id, name, gender, school, grade, status, is_trial)'
    );
    expect(testSessions).toContain(
      'INSERT INTO test_groups (academy_id, test_session_id, group_num, group_name)'
    );
    expect(testSessions).toContain(
      'INSERT INTO test_participants (academy_id, test_session_id, student_id, participant_type)'
    );
    expect(testSessions).toContain(
      'INSERT INTO test_participants (academy_id, test_session_id, student_id, test_applicant_id, participant_type)'
    );
    expect(testSessions).toContain(
      'INSERT INTO test_records (academy_id, test_session_id, test_applicant_id, record_type_id, value, measured_at)'
    );
  });

  it('does not fall back to academy 2 in protected settings routes', () => {
    expect(peakSettings).toContain('req.user.academyId');
    expect(peakSettings).not.toContain('academy_id || 2');
  });

  it('protects configurable admin surfaces with feature permissions', () => {
    expect(analytics).toContain("requireFeaturePermission('analyticsReport')");
    expect(recordTypes).toContain("requireFeaturePermission('measurementSettingsManage')");
    expect(scoreTable).toContain("requireFeaturePermission('measurementSettingsManage')");
    expect(peakSettings).toContain("requireFeaturePermission('measurementSettingsManage')");
  });

  it('stores push subscriptions with user academy id', () => {
    expect(push).toContain(
      'INSERT INTO push_subscriptions (academy_id, user_id, endpoint, p256dh, auth, device_name)'
    );
  });

  it('limits session child mutations to the current session children', () => {
    expect(testSessions).toContain('UPDATE test_participants SET test_group_id = ?');
    expect(testSessions).toContain('WHERE id = ? AND test_session_id = ?');
    expect(testSessions).toContain('DELETE FROM test_participants WHERE id = ? AND test_session_id = ?');
    expect(testSessions).toContain('DELETE FROM test_groups WHERE id = ? AND test_session_id = ?');
  });

  it('reads and deletes test applicant records inside the current academy only', () => {
    expect(monthlyTests).toContain('FROM test_records WHERE academy_id = ? AND test_session_id IN (?)');
    expect(testSessions).toContain('FROM test_records WHERE academy_id = ? AND test_session_id = ?');
    expect(publicBoard).toContain('WHERE academy_id = ? AND test_session_id IN (?)');
    expect(testApplicants).toContain('DELETE FROM test_records WHERE academy_id = ? AND test_applicant_id = ?');
    expect(testApplicants).toContain('SELECT * FROM test_records WHERE academy_id = ? AND test_applicant_id = ?');
  });

  it('requires board PIN access for scoreboard screens without blocking DID absent sync', () => {
    expect(publicBoard.match(/requireBoardAccess\(req, res, academy\)/g)).toHaveLength(2);
    expect(publicBoard).toContain("router.get('/:slug/absent'");
  });
});

describe('backend runtime safety guards', () => {
  const peakServer = source('backend/peak.js');
  const databaseConfig = source('backend/config/database.js');
  const pacaDatabaseConfig = source('backend/config/paca-database.js');
  const trainersRoute = source('backend/routes/trainers.js');
  const encryptionUtil = source('backend/utils/encryption.js');

  it('does not allow every browser origin in backend CORS settings', () => {
    expect(peakServer).not.toContain("origin: '*'");
  });

  it('does not keep hardcoded database password or encryption fallbacks', () => {
    const runtimeSources = [
      databaseConfig,
      pacaDatabaseConfig,
      trainersRoute,
      encryptionUtil,
    ].join('\n');

    expect(runtimeSources).not.toMatch(/password:\s*process\.env\.[A-Z0-9_]+\s*\|\|/);
    expect(runtimeSources).not.toMatch(/DATA_ENCRYPTION_KEY\s*\|\|/);
  });
});
