const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');

const ACADEMY_ID = 2;

// 세션 삭제
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await pool.query('DELETE FROM test_sessions WHERE id = ?', [sessionId]);
    res.json({ success: true, message: '세션이 삭제되었습니다.' });
  } catch (error) {
    console.error('세션 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 조 편성 조회 (감독관 + 학생 포함)
router.get('/:sessionId/groups', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 세션 정보
    const [sessions] = await pool.query(`
      SELECT ts.*, mt.test_name, mt.test_month
      FROM test_sessions ts
      JOIN monthly_tests mt ON ts.monthly_test_id = mt.id
      WHERE ts.id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const session = sessions[0];

    // 조 목록
    const [groups] = await pool.query(`
      SELECT * FROM test_groups
      WHERE test_session_id = ?
      ORDER BY group_num
    `, [sessionId]);

    // 조별 감독관
    const [supervisors] = await pool.query(`
      SELECT tgs.*, tg.group_num
      FROM test_group_supervisors tgs
      JOIN test_groups tg ON tgs.test_group_id = tg.id
      WHERE tg.test_session_id = ?
      ORDER BY tgs.order_num
    `, [sessionId]);

    // P-ACA에서 강사 정보 조회
    const [instructors] = await pacaPool.query(`
      SELECT id, name FROM instructors
      WHERE academy_id = ? AND deleted_at IS NULL
    `, [ACADEMY_ID]);

    // 원장 정보도 조회
    const [owners] = await pacaPool.query(`
      SELECT id, name FROM users
      WHERE academy_id = ? AND role = 'owner' AND deleted_at IS NULL
    `, [ACADEMY_ID]);

    // 강사/원장 맵 생성
    const instructorMap = {};
    instructors.forEach(i => {
      instructorMap[i.id] = decrypt(i.name);
    });
    owners.forEach(o => {
      instructorMap[-o.id] = decrypt(o.name); // 원장은 음수 ID
    });

    // 조별 감독관 매핑
    const supervisorsByGroup = {};
    supervisors.forEach(s => {
      if (!supervisorsByGroup[s.test_group_id]) {
        supervisorsByGroup[s.test_group_id] = [];
      }
      supervisorsByGroup[s.test_group_id].push({
        id: s.id,
        instructor_id: s.instructor_id,
        name: instructorMap[s.instructor_id] || '알 수 없음',
        is_main: s.is_main,
        isOwner: s.instructor_id < 0
      });
    });

    // 참가자 목록 (학생)
    const [participants] = await pool.query(`
      SELECT tp.*, s.name as student_name, s.gender, s.school, s.grade
      FROM test_participants tp
      LEFT JOIN students s ON tp.student_id = s.id
      WHERE tp.test_session_id = ?
      ORDER BY tp.order_num
    `, [sessionId]);

    // 테스트신규 학생 정보 조회
    const testApplicantIds = participants
      .filter(p => p.test_applicant_id)
      .map(p => p.test_applicant_id);

    let applicantMap = {};
    if (testApplicantIds.length > 0) {
      const [applicants] = await pacaPool.query(`
        SELECT id, name, gender, school, grade FROM test_applicants
        WHERE id IN (?)
      `, [testApplicantIds]);

      applicants.forEach(a => {
        applicantMap[a.id] = {
          name: decrypt(a.name),
          gender: a.gender === 'male' ? 'M' : 'F',
          school: a.school,
          grade: a.grade
        };
      });
    }

    // 참가자 매핑
    const participantsByGroup = { waiting: [] };
    groups.forEach(g => {
      participantsByGroup[g.id] = [];
    });

    participants.forEach(p => {
      let info;
      if (p.student_id) {
        info = {
          id: p.id,
          student_id: p.student_id,
          name: p.student_name,
          gender: p.gender,
          school: p.school,
          grade: p.grade,
          participant_type: p.participant_type,
          attendance_status: p.attendance_status
        };
      } else if (p.test_applicant_id && applicantMap[p.test_applicant_id]) {
        const a = applicantMap[p.test_applicant_id];
        info = {
          id: p.id,
          test_applicant_id: p.test_applicant_id,
          name: a.name,
          gender: a.gender,
          school: a.school,
          grade: a.grade,
          participant_type: 'test_new',
          attendance_status: p.attendance_status
        };
      }

      if (info) {
        if (p.test_group_id && participantsByGroup[p.test_group_id]) {
          participantsByGroup[p.test_group_id].push(info);
        } else {
          participantsByGroup.waiting.push(info);
        }
      }
    });

    // 응답 구성
    const groupsWithData = groups.map(g => ({
      id: g.id,
      group_num: g.group_num,
      group_name: g.group_name,
      supervisors: supervisorsByGroup[g.id] || [],
      participants: participantsByGroup[g.id] || []
    }));

    // 미배치 감독관 (출근한 강사 중 배치 안 된 강사)
    const assignedInstructorIds = new Set(supervisors.map(s => s.instructor_id));
    const waitingInstructors = [];

    // 모든 강사를 대기로 추가 (배치된 경우 제외)
    instructors.forEach(i => {
      if (!assignedInstructorIds.has(i.id)) {
        waitingInstructors.push({
          instructor_id: i.id,
          name: decrypt(i.name),
          isOwner: false
        });
      }
    });

    // 원장도 추가
    owners.forEach(o => {
      if (!assignedInstructorIds.has(-o.id)) {
        waitingInstructors.push({
          instructor_id: -o.id,
          name: decrypt(o.name),
          isOwner: true
        });
      }
    });

    res.json({
      success: true,
      session,
      groups: groupsWithData,
      waitingParticipants: participantsByGroup.waiting,
      waitingInstructors
    });
  } catch (error) {
    console.error('조 편성 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 조 생성
router.post('/:sessionId/groups', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { group_name } = req.body;

    // 다음 group_num 계산
    const [maxNum] = await pool.query(`
      SELECT MAX(group_num) as max_num FROM test_groups WHERE test_session_id = ?
    `, [sessionId]);

    const nextNum = (maxNum[0].max_num || 0) + 1;

    const [result] = await pool.query(`
      INSERT INTO test_groups (test_session_id, group_num, group_name)
      VALUES (?, ?, ?)
    `, [sessionId, nextNum, group_name || `${nextNum}조`]);

    res.json({ success: true, id: result.insertId, group_num: nextNum });
  } catch (error) {
    console.error('조 생성 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 조 삭제
router.delete('/:sessionId/groups/:groupId', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { groupId } = req.params;

    // 해당 조의 학생들을 미배치로 변경
    await conn.query(`
      UPDATE test_participants SET test_group_id = NULL WHERE test_group_id = ?
    `, [groupId]);

    // 조 삭제 (감독관은 CASCADE로 삭제)
    await conn.query('DELETE FROM test_groups WHERE id = ?', [groupId]);

    await conn.commit();
    res.json({ success: true, message: '조가 삭제되었습니다.' });
  } catch (error) {
    await conn.rollback();
    console.error('조 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// 감독관 배치
router.post('/:sessionId/supervisor', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { sessionId } = req.params;
    const { instructor_id, to_group_id, is_main } = req.body;

    // to_group_id가 null이면 대기로 이동 (기존 배치 삭제)
    if (!to_group_id) {
      await conn.query(`
        DELETE tgs FROM test_group_supervisors tgs
        JOIN test_groups tg ON tgs.test_group_id = tg.id
        WHERE tg.test_session_id = ? AND tgs.instructor_id = ?
      `, [sessionId, instructor_id]);

      await conn.commit();
      return res.json({ success: true, message: '감독관이 대기로 이동되었습니다.' });
    }

    // 기존 배치 삭제
    await conn.query(`
      DELETE tgs FROM test_group_supervisors tgs
      JOIN test_groups tg ON tgs.test_group_id = tg.id
      WHERE tg.test_session_id = ? AND tgs.instructor_id = ?
    `, [sessionId, instructor_id]);

    // 새 조에 배치
    // 주감독 지정 시 기존 주감독은 보조로
    if (is_main) {
      await conn.query(`
        UPDATE test_group_supervisors SET is_main = 0
        WHERE test_group_id = ? AND is_main = 1
      `, [to_group_id]);
    }

    // 다음 order_num
    const [maxOrder] = await conn.query(`
      SELECT MAX(order_num) as max_order FROM test_group_supervisors WHERE test_group_id = ?
    `, [to_group_id]);

    const nextOrder = (maxOrder[0].max_order || 0) + 1;

    await conn.query(`
      INSERT INTO test_group_supervisors (test_group_id, instructor_id, is_main, order_num)
      VALUES (?, ?, ?, ?)
    `, [to_group_id, instructor_id, is_main ? 1 : 0, nextOrder]);

    await conn.commit();
    res.json({ success: true, message: '감독관이 배치되었습니다.' });
  } catch (error) {
    await conn.rollback();
    console.error('감독관 배치 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// 참가자 조 배치 변경
router.put('/:sessionId/participants/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const { test_group_id, order_num } = req.body;

    await pool.query(`
      UPDATE test_participants
      SET test_group_id = ?, order_num = ?
      WHERE id = ?
    `, [test_group_id, order_num || 0, participantId]);

    res.json({ success: true, message: '참가자가 배치되었습니다.' });
  } catch (error) {
    console.error('참가자 배치 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 재원생 동기화
router.post('/:sessionId/participants/sync', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { sessionId } = req.params;

    // 기존 참가자 student_id 목록
    const [existing] = await conn.query(`
      SELECT student_id FROM test_participants
      WHERE test_session_id = ? AND student_id IS NOT NULL
    `, [sessionId]);

    const existingIds = new Set(existing.map(e => e.student_id));

    // P-EAK에서 재원생 조회
    const [students] = await pool.query(`
      SELECT id, name, gender, school, grade, status, is_trial
      FROM students
      WHERE status = 'active' OR is_trial = 1
      ORDER BY name
    `);

    let added = 0;
    for (const s of students) {
      if (!existingIds.has(s.id)) {
        const participantType = s.is_trial ? 'trial' : 'enrolled';
        await conn.query(`
          INSERT INTO test_participants (test_session_id, student_id, participant_type)
          VALUES (?, ?, ?)
        `, [sessionId, s.id, participantType]);
        added++;
      }
    }

    await conn.commit();
    res.json({
      success: true,
      message: `재원생 ${added}명이 추가되었습니다.`,
      added
    });
  } catch (error) {
    await conn.rollback();
    console.error('재원생 동기화 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// 참가자 수동 추가 (휴원생/테스트신규)
router.post('/:sessionId/participants', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { student_id, test_applicant_id, participant_type } = req.body;

    // 중복 체크
    if (student_id) {
      const [dup] = await pool.query(`
        SELECT id FROM test_participants
        WHERE test_session_id = ? AND student_id = ?
      `, [sessionId, student_id]);

      if (dup.length > 0) {
        return res.status(400).json({ success: false, message: '이미 추가된 학생입니다.' });
      }
    }

    if (test_applicant_id) {
      const [dup] = await pool.query(`
        SELECT id FROM test_participants
        WHERE test_session_id = ? AND test_applicant_id = ?
      `, [sessionId, test_applicant_id]);

      if (dup.length > 0) {
        return res.status(400).json({ success: false, message: '이미 추가된 학생입니다.' });
      }
    }

    const [result] = await pool.query(`
      INSERT INTO test_participants (test_session_id, student_id, test_applicant_id, participant_type)
      VALUES (?, ?, ?, ?)
    `, [sessionId, student_id, test_applicant_id, participant_type]);

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('참가자 추가 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 참가자 제거
router.delete('/:sessionId/participants/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;

    await pool.query('DELETE FROM test_participants WHERE id = ?', [participantId]);

    res.json({ success: true, message: '참가자가 제거되었습니다.' });
  } catch (error) {
    console.error('참가자 제거 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 기록 조회
router.get('/:sessionId/records', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 세션 정보 및 선택된 종목
    const [sessions] = await pool.query(`
      SELECT ts.*, mt.id as monthly_test_id
      FROM test_sessions ts
      JOIN monthly_tests mt ON ts.monthly_test_id = mt.id
      WHERE ts.id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const session = sessions[0];

    // 선택된 종목
    const [types] = await pool.query(`
      SELECT mtt.*, rt.name, rt.short_name, rt.unit, rt.direction
      FROM monthly_test_types mtt
      JOIN record_types rt ON mtt.record_type_id = rt.id
      WHERE mtt.monthly_test_id = ?
      ORDER BY mtt.display_order
    `, [session.monthly_test_id]);

    // 참가자 목록
    const [participants] = await pool.query(`
      SELECT tp.*, s.name as student_name, s.gender, s.school, s.grade
      FROM test_participants tp
      LEFT JOIN students s ON tp.student_id = s.id
      WHERE tp.test_session_id = ?
      ORDER BY tp.test_group_id, tp.order_num
    `, [sessionId]);

    // 테스트신규 정보
    const testApplicantIds = participants
      .filter(p => p.test_applicant_id)
      .map(p => p.test_applicant_id);

    let applicantMap = {};
    if (testApplicantIds.length > 0) {
      const [applicants] = await pacaPool.query(`
        SELECT id, name, gender, school, grade FROM test_applicants
        WHERE id IN (?)
      `, [testApplicantIds]);

      applicants.forEach(a => {
        applicantMap[a.id] = {
          name: decrypt(a.name),
          gender: a.gender === 'male' ? 'M' : 'F',
          school: a.school,
          grade: a.grade
        };
      });
    }

    // 재원생 기록 (student_records)
    const studentIds = participants.filter(p => p.student_id).map(p => p.student_id);
    let studentRecords = {};

    if (studentIds.length > 0) {
      const [records] = await pool.query(`
        SELECT student_id, record_type_id, value
        FROM student_records
        WHERE student_id IN (?) AND measured_at = ?
      `, [studentIds, session.test_date]);

      records.forEach(r => {
        if (!studentRecords[r.student_id]) studentRecords[r.student_id] = {};
        studentRecords[r.student_id][r.record_type_id] = r.value;
      });
    }

    // 테스트신규 기록 (test_records)
    let applicantRecords = {};
    if (testApplicantIds.length > 0) {
      const [records] = await pool.query(`
        SELECT test_applicant_id, record_type_id, value
        FROM test_records
        WHERE test_session_id = ? AND test_applicant_id IN (?)
      `, [sessionId, testApplicantIds]);

      records.forEach(r => {
        if (!applicantRecords[r.test_applicant_id]) applicantRecords[r.test_applicant_id] = {};
        applicantRecords[r.test_applicant_id][r.record_type_id] = r.value;
      });
    }

    // 참가자 데이터 구성
    const participantsWithRecords = participants.map(p => {
      let info;
      let records;

      if (p.student_id) {
        info = {
          id: p.id,
          student_id: p.student_id,
          name: p.student_name,
          gender: p.gender,
          school: p.school,
          grade: p.grade,
          participant_type: p.participant_type
        };
        records = studentRecords[p.student_id] || {};
      } else if (p.test_applicant_id && applicantMap[p.test_applicant_id]) {
        const a = applicantMap[p.test_applicant_id];
        info = {
          id: p.id,
          test_applicant_id: p.test_applicant_id,
          name: a.name,
          gender: a.gender,
          school: a.school,
          grade: a.grade,
          participant_type: 'test_new'
        };
        records = applicantRecords[p.test_applicant_id] || {};
      }

      return info ? { ...info, records } : null;
    }).filter(Boolean);

    res.json({
      success: true,
      session,
      record_types: types,
      participants: participantsWithRecords
    });
  } catch (error) {
    console.error('기록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 기록 일괄 저장
router.post('/:sessionId/records/batch', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { sessionId } = req.params;
    const { records } = req.body;
    // records: [{ participant_id, student_id?, test_applicant_id?, record_type_id, value }]

    // 세션 날짜 조회
    const [sessions] = await conn.query(`
      SELECT test_date FROM test_sessions WHERE id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const testDate = sessions[0].test_date;

    // 종목별 direction 조회
    const [types] = await conn.query(`
      SELECT id, direction FROM record_types
    `);
    const directionMap = {};
    types.forEach(t => directionMap[t.id] = t.direction);

    const results = [];

    for (const r of records) {
      if (r.student_id) {
        // 재원생: student_records에 UPSERT
        const [existing] = await conn.query(`
          SELECT id, value FROM student_records
          WHERE student_id = ? AND record_type_id = ? AND measured_at = ?
        `, [r.student_id, r.record_type_id, testDate]);

        if (existing.length > 0) {
          const direction = directionMap[r.record_type_id] || 'higher';
          const oldValue = parseFloat(existing[0].value);
          const newValue = parseFloat(r.value);
          const isBetter = direction === 'higher' ? newValue > oldValue : newValue < oldValue;

          if (isBetter) {
            await conn.query(`
              UPDATE student_records SET value = ? WHERE id = ?
            `, [r.value, existing[0].id]);
            results.push({ action: 'updated', student_id: r.student_id });
          } else {
            results.push({ action: 'skipped', student_id: r.student_id });
          }
        } else {
          await conn.query(`
            INSERT INTO student_records (student_id, record_type_id, value, measured_at)
            VALUES (?, ?, ?, ?)
          `, [r.student_id, r.record_type_id, r.value, testDate]);
          results.push({ action: 'inserted', student_id: r.student_id });
        }
      } else if (r.test_applicant_id) {
        // 테스트신규: test_records에 UPSERT
        await conn.query(`
          INSERT INTO test_records (test_session_id, test_applicant_id, record_type_id, value, measured_at)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE value = VALUES(value)
        `, [sessionId, r.test_applicant_id, r.record_type_id, r.value, testDate]);
        results.push({ action: 'saved', test_applicant_id: r.test_applicant_id });
      }
    }

    await conn.commit();
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    await conn.rollback();
    console.error('기록 저장 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
