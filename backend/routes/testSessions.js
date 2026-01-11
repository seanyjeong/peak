const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');

// 세션 삭제
router.delete('/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const academyId = req.user.academyId;

    // academy_id 검증: 해당 학원의 세션인지 확인
    const [sessions] = await pool.query(`
      SELECT ts.id FROM test_sessions ts
      JOIN monthly_tests mt ON ts.monthly_test_id = mt.id
      WHERE ts.id = ? AND mt.academy_id = ?
    `, [sessionId, academyId]);

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    await pool.query('DELETE FROM test_sessions WHERE id = ?', [sessionId]);
    res.json({ success: true, message: '세션이 삭제되었습니다.' });
  } catch (error) {
    console.error('세션 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 조 편성 조회 (감독관 + 학생 포함) - P-ACA 자동 동기화
router.get('/:sessionId/groups', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const academyId = req.user.academyId;
    const { sessionId } = req.params;

    // 세션 정보
    const [sessions] = await conn.query(`
      SELECT ts.*, mt.test_name, mt.test_month, mt.id as monthly_test_id
      FROM test_sessions ts
      JOIN monthly_tests mt ON ts.monthly_test_id = mt.id
      WHERE ts.id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const session = sessions[0];

    // === P-ACA 자동 동기화 ===
    // 1. P-ACA에서 현재 active 재원생 조회
    const [pacaActiveStudents] = await pacaPool.query(`
      SELECT id, name, gender, school, grade
      FROM students
      WHERE academy_id = ? AND status = 'active' AND deleted_at IS NULL
    `, [academyId]);

    const pacaActiveIds = new Set(pacaActiveStudents.map(s => s.id));

    // 2. 같은 테스트의 모든 세션에서 이미 등록된 학생 (paca_student_id 기준)
    const [allParticipants] = await conn.query(`
      SELECT tp.id, tp.student_id, tp.test_session_id, s.paca_student_id
      FROM test_participants tp
      JOIN test_sessions ts ON tp.test_session_id = ts.id
      JOIN students s ON tp.student_id = s.id
      WHERE ts.monthly_test_id = ? AND tp.student_id IS NOT NULL
    `, [session.monthly_test_id]);

    const registeredPacaIds = new Set(allParticipants.map(p => p.paca_student_id));

    // 3. P-ACA에 active인데 아직 등록 안 된 학생 → 자동 추가
    const toAdd = pacaActiveStudents.filter(ps => !registeredPacaIds.has(ps.id));

    if (toAdd.length > 0) {
      // P-EAK students에서 paca_student_id로 매칭
      const toAddPacaIds = toAdd.map(s => s.id);
      const [peakStudents] = await conn.query(`
        SELECT id, paca_student_id FROM students WHERE paca_student_id IN (?)
      `, [toAddPacaIds]);

      const peakStudentMap = {};
      peakStudents.forEach(s => { peakStudentMap[s.paca_student_id] = s.id; });

      for (const ps of toAdd) {
        let peakStudentId = peakStudentMap[ps.id];

        // P-EAK에 없으면 생성
        if (!peakStudentId) {
          const [insertResult] = await conn.query(`
            INSERT INTO students (paca_student_id, name, gender, school, grade, status, is_trial)
            VALUES (?, ?, ?, ?, ?, 'active', 0)
          `, [ps.id, decrypt(ps.name), ps.gender === 'male' ? 'M' : 'F', ps.school, ps.grade]);
          peakStudentId = insertResult.insertId;
        }

        // test_participants에 추가
        await conn.query(`
          INSERT INTO test_participants (test_session_id, student_id, participant_type)
          VALUES (?, ?, 'enrolled')
        `, [sessionId, peakStudentId]);
      }
    }

    // 4. test_participants에 있지만 P-ACA에서 더 이상 active가 아닌 enrolled 학생만 자동 제거
    // (휴원생/체험생은 수동 추가이므로 자동 제거하지 않음)
    const [thisSessionEnrolled] = await conn.query(`
      SELECT tp.id, s.paca_student_id
      FROM test_participants tp
      JOIN students s ON tp.student_id = s.id
      WHERE tp.test_session_id = ? AND tp.participant_type = 'enrolled' AND s.paca_student_id IS NOT NULL
    `, [sessionId]);

    const toRemove = thisSessionEnrolled.filter(p => !pacaActiveIds.has(p.paca_student_id));

    if (toRemove.length > 0) {
      const toRemoveIds = toRemove.map(p => p.id);
      await conn.query(`DELETE FROM test_participants WHERE id IN (?)`, [toRemoveIds]);
    }
    // === 동기화 끝 ===

    // 조 목록
    const [groups] = await conn.query(`
      SELECT * FROM test_groups
      WHERE test_session_id = ?
      ORDER BY group_num
    `, [sessionId]);

    // 조별 감독관
    const [supervisors] = await conn.query(`
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
    `, [academyId]);

    // 원장 정보도 조회
    const [owners] = await pacaPool.query(`
      SELECT id, name FROM users
      WHERE academy_id = ? AND role = 'owner' AND deleted_at IS NULL
    `, [academyId]);

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
    const [participants] = await conn.query(`
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
  } finally {
    conn.release();
  }
});

// 조 생성
router.post('/:sessionId/groups', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { group_name } = req.body || {};

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
router.delete('/:sessionId/groups/:groupId', verifyToken, async (req, res) => {
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
router.post('/:sessionId/supervisor', verifyToken, async (req, res) => {
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
router.put('/:sessionId/participants/:participantId', verifyToken, async (req, res) => {
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

// 재원생 동기화 (재원생만, 체험생 제외) - P-ACA 상태 기준으로 조회
router.post('/:sessionId/participants/sync', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const academyId = req.user.academyId;
    const { sessionId } = req.params;

    // 세션의 테스트 ID 조회
    const [sessions] = await conn.query(`
      SELECT monthly_test_id FROM test_sessions WHERE id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      throw new Error('세션을 찾을 수 없습니다.');
    }

    const monthlyTestId = sessions[0].monthly_test_id;

    // 같은 테스트의 모든 세션에서 이미 등록된 학생 조회 (중복 방지)
    const [existing] = await conn.query(`
      SELECT tp.student_id
      FROM test_participants tp
      JOIN test_sessions ts ON tp.test_session_id = ts.id
      WHERE ts.monthly_test_id = ? AND tp.student_id IS NOT NULL
    `, [monthlyTestId]);

    const existingIds = new Set(existing.map(e => e.student_id));

    // P-ACA에서 재원생(active)만 조회 (미등록, 체험, 휴원, 졸업 제외)
    const [pacaStudents] = await pacaPool.query(`
      SELECT id, name, gender, school, grade
      FROM students
      WHERE academy_id = ? AND status = 'active' AND deleted_at IS NULL
      ORDER BY name
    `, [academyId]);

    // P-ACA 학생 ID로 P-EAK students에서 매칭되는 학생 찾기
    const pacaIds = pacaStudents.map(s => s.id);

    let peakStudentMap = {};
    if (pacaIds.length > 0) {
      const [peakStudents] = await conn.query(`
        SELECT id, paca_student_id FROM students WHERE paca_student_id IN (?)
      `, [pacaIds]);
      peakStudents.forEach(s => {
        peakStudentMap[s.paca_student_id] = s.id;
      });
    }

    let added = 0;
    for (const ps of pacaStudents) {
      const peakStudentId = peakStudentMap[ps.id];

      // P-EAK에 없는 학생이면 생성
      if (!peakStudentId) {
        const [insertResult] = await conn.query(`
          INSERT INTO students (paca_student_id, name, gender, school, grade, status, is_trial)
          VALUES (?, ?, ?, ?, ?, 'active', 0)
        `, [ps.id, decrypt(ps.name), ps.gender === 'male' ? 'M' : 'F', ps.school, ps.grade]);

        const newStudentId = insertResult.insertId;
        if (!existingIds.has(newStudentId)) {
          await conn.query(`
            INSERT INTO test_participants (test_session_id, student_id, participant_type)
            VALUES (?, ?, 'enrolled')
          `, [sessionId, newStudentId]);
          added++;
        }
      } else if (!existingIds.has(peakStudentId)) {
        // 기존 P-EAK 학생이 이미 등록되지 않았으면 추가
        await conn.query(`
          INSERT INTO test_participants (test_session_id, student_id, participant_type)
          VALUES (?, ?, 'enrolled')
        `, [sessionId, peakStudentId]);
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

// 추가 가능 학생 목록 (휴원생, 체험생, 테스트신규 - P-ACA에서 조회)
router.get('/:sessionId/available-students', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const { sessionId } = req.params;
    const { type } = req.query; // 'rest' | 'trial' | 'test_new'

    // 세션의 테스트 ID 조회
    const [sessions] = await pool.query(`
      SELECT monthly_test_id FROM test_sessions WHERE id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const monthlyTestId = sessions[0].monthly_test_id;

    // 테스트신규인 경우 별도 처리
    if (type === 'test_new') {
      // 같은 테스트의 모든 세션에서 이미 참가한 test_applicant_id 목록
      const [existingApplicants] = await pool.query(`
        SELECT tp.test_applicant_id
        FROM test_participants tp
        JOIN test_sessions ts ON tp.test_session_id = ts.id
        WHERE ts.monthly_test_id = ? AND tp.test_applicant_id IS NOT NULL
      `, [monthlyTestId]);

      const existingApplicantIds = existingApplicants.map(e => e.test_applicant_id);

      // P-ACA test_applicants에서 pending 상태인 학생 조회
      const [applicants] = await pacaPool.query(`
        SELECT id, name, gender, school, grade, phone
        FROM test_applicants
        WHERE academy_id = ? AND status = 'pending'
        ${existingApplicantIds.length > 0 ? `AND id NOT IN (${existingApplicantIds.join(',')})` : ''}
        ORDER BY name
      `, [academyId]);

      const students = applicants.map(a => ({
        id: a.id,  // test_applicant_id
        name: decrypt(a.name),
        gender: a.gender === 'male' ? 'M' : 'F',
        school: a.school,
        grade: a.grade,
        isTestApplicant: true  // 테스트신규임을 표시
      }));

      return res.json({ success: true, students });
    }

    // 휴원생/체험생인 경우
    // 같은 테스트의 모든 세션에서 이미 참가한 학생의 paca_student_id 목록
    const [existing] = await pool.query(`
      SELECT s.paca_student_id
      FROM test_participants tp
      JOIN test_sessions ts ON tp.test_session_id = ts.id
      JOIN students s ON tp.student_id = s.id
      WHERE ts.monthly_test_id = ? AND tp.student_id IS NOT NULL
    `, [monthlyTestId]);

    const existingPacaIds = existing.map(e => e.paca_student_id).filter(Boolean);

    let whereClause = '';
    if (type === 'rest') {
      whereClause = "status = 'paused'";  // P-ACA에서 휴원은 paused
    } else if (type === 'trial') {
      whereClause = "status = 'trial'";   // P-ACA에서 체험은 trial
    } else if (type === 'pending') {
      whereClause = "status = 'pending'"; // P-ACA에서 미등록은 pending
    } else {
      return res.status(400).json({ success: false, message: 'type 파라미터가 필요합니다 (rest, trial, pending, test_new)' });
    }

    // P-ACA에서 학생 목록 조회
    const [pacaStudents] = await pacaPool.query(`
      SELECT id, name, gender, school, grade
      FROM students
      WHERE academy_id = ? AND ${whereClause} AND deleted_at IS NULL
      ${existingPacaIds.length > 0 ? `AND id NOT IN (${existingPacaIds.join(',')})` : ''}
      ORDER BY name
    `, [academyId]);

    // 이름 복호화 + 성별 변환
    const students = pacaStudents.map(s => ({
      id: s.id,  // P-ACA student id
      name: decrypt(s.name),
      gender: s.gender === 'male' ? 'M' : 'F',
      school: s.school,
      grade: s.grade,
      isPaca: true  // P-ACA 학생임을 표시
    }));

    res.json({ success: true, students });
  } catch (error) {
    console.error('추가 가능 학생 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 참가자 수동 추가 (휴원생/체험생/테스트신규)
router.post('/:sessionId/participants', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    let { student_id, paca_student_id, test_applicant_id, participant_type } = req.body;

    // P-ACA 학생인 경우 (휴원생/체험생)
    if (paca_student_id && !student_id) {
      // P-EAK students에서 조회
      const [existing] = await pool.query(`
        SELECT id FROM students WHERE paca_student_id = ?
      `, [paca_student_id]);

      if (existing.length > 0) {
        student_id = existing[0].id;
      } else {
        // P-ACA에서 학생 정보 가져와서 P-EAK에 생성
        const [pacaStudent] = await pacaPool.query(`
          SELECT id, name, gender, school, grade, status
          FROM students WHERE id = ?
        `, [paca_student_id]);

        if (pacaStudent.length === 0) {
          return res.status(404).json({ success: false, message: '학생을 찾을 수 없습니다.' });
        }

        const ps = pacaStudent[0];
        const isTrial = ps.status === 'trial';
        const peakStatus = ps.status === 'paused' ? 'rest' : (ps.status === 'trial' ? 'active' : ps.status);

        const [insertResult] = await pool.query(`
          INSERT INTO students (paca_student_id, name, gender, school, grade, status, is_trial)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [paca_student_id, decrypt(ps.name), ps.gender === 'male' ? 'M' : 'F', ps.school, ps.grade, peakStatus, isTrial ? 1 : 0]);

        student_id = insertResult.insertId;
      }
    }

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
router.delete('/:sessionId/participants/:participantId', verifyToken, async (req, res) => {
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
router.get('/:sessionId/records', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
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

    // 조 및 강사 정보 조회
    const [groups] = await pool.query(`
      SELECT * FROM test_groups WHERE test_session_id = ? ORDER BY group_num
    `, [sessionId]);

    const [supervisors] = await pool.query(`
      SELECT tgs.*, tg.group_num, tg.id as group_id
      FROM test_group_supervisors tgs
      JOIN test_groups tg ON tgs.test_group_id = tg.id
      WHERE tg.test_session_id = ?
      ORDER BY tg.group_num, tgs.is_main DESC
    `, [sessionId]);

    // P-ACA에서 강사/원장 정보
    const [instructors] = await pacaPool.query(`
      SELECT id, name FROM instructors WHERE academy_id = ? AND deleted_at IS NULL
    `, [academyId]);
    const [owners] = await pacaPool.query(`
      SELECT id, name FROM users WHERE academy_id = ? AND role = 'owner' AND deleted_at IS NULL
    `, [academyId]);

    const instructorMap = {};
    instructors.forEach(i => { instructorMap[i.id] = decrypt(i.name); });
    owners.forEach(o => { instructorMap[-o.id] = decrypt(o.name); });

    // 조별 강사 매핑
    const groupsWithInstructors = groups.map(g => {
      const groupSupervisors = supervisors
        .filter(s => s.group_id === g.id)
        .map(s => ({
          instructor_id: s.instructor_id,
          name: instructorMap[s.instructor_id] || '알 수 없음',
          is_main: s.is_main
        }));
      return {
        id: g.id,
        group_num: g.group_num,
        instructors: groupSupervisors
      };
    });

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
          participant_type: p.participant_type,
          test_group_id: p.test_group_id
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
          participant_type: 'test_new',
          test_group_id: p.test_group_id
        };
        records = applicantRecords[p.test_applicant_id] || {};
      }

      return info ? { ...info, records } : null;
    }).filter(Boolean);

    // 배점표 조회
    const recordTypeIds = types.map(t => t.record_type_id);
    let scoreRangesMap = {};

    if (recordTypeIds.length > 0) {
      const [scoreTables] = await pool.query(`
        SELECT id, record_type_id FROM score_tables WHERE record_type_id IN (?)
      `, [recordTypeIds]);

      const scoreTableIds = scoreTables.map(st => st.id);

      if (scoreTableIds.length > 0) {
        const [scoreRanges] = await pool.query(`
          SELECT sr.*, st.record_type_id
          FROM score_ranges sr
          JOIN score_tables st ON sr.score_table_id = st.id
          WHERE sr.score_table_id IN (?)
          ORDER BY sr.score DESC
        `, [scoreTableIds]);

        scoreRanges.forEach(sr => {
          if (!scoreRangesMap[sr.record_type_id]) {
            scoreRangesMap[sr.record_type_id] = [];
          }
          scoreRangesMap[sr.record_type_id].push({
            score: sr.score,
            male_min: sr.male_min,
            male_max: sr.male_max,
            female_min: sr.female_min,
            female_max: sr.female_max
          });
        });
      }
    }

    res.json({
      success: true,
      session,
      record_types: types,
      participants: participantsWithRecords,
      score_ranges: scoreRangesMap,
      groups: groupsWithInstructors
    });
  } catch (error) {
    console.error('기록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 기록 일괄 저장
router.post('/:sessionId/records/batch', verifyToken, async (req, res) => {
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
        // 재원생: student_records에 UPSERT (항상 덮어쓰기 - 수정 가능하도록)
        await conn.query(`
          INSERT INTO student_records (student_id, record_type_id, value, measured_at)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE value = VALUES(value)
        `, [r.student_id, r.record_type_id, r.value, testDate]);
        results.push({ action: 'saved', student_id: r.student_id });
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

// 세션 기록 전체 삭제
router.delete('/:sessionId/records', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { sessionId } = req.params;

    // 세션 정보 조회
    const [sessions] = await conn.query(`
      SELECT id, test_date FROM test_sessions WHERE id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const testDate = sessions[0].test_date;

    // 세션 참가자 조회
    const [participants] = await conn.query(`
      SELECT student_id, test_applicant_id FROM test_participants WHERE test_session_id = ?
    `, [sessionId]);

    const studentIds = participants.filter(p => p.student_id).map(p => p.student_id);
    const applicantIds = participants.filter(p => p.test_applicant_id).map(p => p.test_applicant_id);

    let deletedStudentRecords = 0;
    let deletedApplicantRecords = 0;

    // 재원생 기록 삭제 (해당 날짜의 기록만)
    if (studentIds.length > 0) {
      const [result] = await conn.query(`
        DELETE FROM student_records
        WHERE student_id IN (?) AND measured_at = ?
      `, [studentIds, testDate]);
      deletedStudentRecords = result.affectedRows;
    }

    // 테스트신규 기록 삭제
    if (applicantIds.length > 0) {
      const [result] = await conn.query(`
        DELETE FROM test_records
        WHERE test_session_id = ? AND test_applicant_id IN (?)
      `, [sessionId, applicantIds]);
      deletedApplicantRecords = result.affectedRows;
    }

    await conn.commit();
    res.json({
      success: true,
      message: '세션 기록이 삭제되었습니다.',
      deleted: {
        studentRecords: deletedStudentRecords,
        applicantRecords: deletedApplicantRecords,
        total: deletedStudentRecords + deletedApplicantRecords
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('세션 기록 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ===== 스케줄 관리 =====

/**
 * 스케줄 알고리즘: 동적 타임슬롯 + 충돌 회피 + 공평한 휴식
 *
 * 요구사항:
 * 1. 충돌 종목은 같은 타임에 배치 안됨
 * 2. 같은 종목을 같은 타임에 여러 조가 할 수 없음
 * 3. 각 조가 모든 종목을 정확히 한 번씩
 * 4. 휴식은 최소화
 * 5. 휴식이 필요하면 모든 조가 공평하게 (각 조당 동일 횟수)
 * 6. 휴식 타임은 조별로 겹치지 않음
 */
function generateScheduleAlgorithm(groups, recordTypes, conflicts) {
  const G = groups.length;
  const T = recordTypes.length;

  if (G === 0 || T === 0) {
    return [];
  }

  console.log(`[스케줄] 시작: ${G}개 조, ${T}개 종목, ${conflicts.length}개 충돌`);

  // 충돌 Set 생성 (record_type_id 기준)
  const conflictSet = new Set(
    conflicts.map(c => {
      const [min, max] = c.record_type_id_1 < c.record_type_id_2
        ? [c.record_type_id_1, c.record_type_id_2]
        : [c.record_type_id_2, c.record_type_id_1];
      return `${min}-${max}`;
    })
  );
  console.log(`[스케줄] 충돌 세트:`, [...conflictSet]);

  // 종목 인덱스로 충돌 체크
  const isConflict = (idx1, idx2) => {
    if (idx1 === null || idx2 === null || idx1 === idx2) return false;
    const id1 = recordTypes[idx1].record_type_id;
    const id2 = recordTypes[idx2].record_type_id;
    const [min, max] = id1 < id2 ? [id1, id2] : [id2, id1];
    return conflictSet.has(`${min}-${max}`);
  };

  // 각 조가 완료한 종목 추적
  const groupDone = Array.from({ length: G }, () => new Set());
  // 각 조의 휴식 횟수
  const groupRestCount = Array(G).fill(0);

  // matrix[time][group] = 종목 인덱스 (null = 휴식)
  const matrix = [];

  // 최대 슬롯 수 (무한루프 방지)
  const maxSlots = G + T + conflicts.length * G;

  let time = 0;
  while (time < maxSlots) {
    // 모든 조가 모든 종목을 완료했는지 확인
    const allDone = groupDone.every(done => done.size === T);
    if (allDone) {
      console.log(`[스케줄] 모든 조 완료! 총 ${time}개 타임`);
      break;
    }

    const row = Array(G).fill(null);
    const usedInThisSlot = new Set(); // 이 타임에 사용된 종목 인덱스

    // 휴식이 가장 적은 조부터 배정 (공평성)
    const groupOrder = [...Array(G).keys()].sort((a, b) => {
      // 이미 완료한 조는 뒤로
      const aDone = groupDone[a].size === T;
      const bDone = groupDone[b].size === T;
      if (aDone !== bDone) return aDone ? 1 : -1;
      // 휴식 적은 조 우선
      return groupRestCount[a] - groupRestCount[b];
    });

    for (const g of groupOrder) {
      // 이미 모든 종목 완료한 조는 휴식
      if (groupDone[g].size === T) {
        row[g] = null;
        groupRestCount[g]++;
        continue;
      }

      // 가능한 종목 찾기
      let assigned = false;
      for (let typeIdx = 0; typeIdx < T; typeIdx++) {
        // 이미 한 종목이면 스킵
        if (groupDone[g].has(typeIdx)) continue;

        // 이 타임에 이미 다른 조가 하고 있으면 스킵
        if (usedInThisSlot.has(typeIdx)) continue;

        // 충돌 체크: 이 타임의 다른 종목과 충돌하면 스킵
        let hasConflict = false;
        for (const usedIdx of usedInThisSlot) {
          if (isConflict(typeIdx, usedIdx)) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) continue;

        // 배정!
        row[g] = typeIdx;
        usedInThisSlot.add(typeIdx);
        groupDone[g].add(typeIdx);
        assigned = true;
        break;
      }

      // 못 찾으면 휴식
      if (!assigned) {
        row[g] = null;
        groupRestCount[g]++;
      }
    }

    matrix.push(row);
    time++;
  }

  // 디버그: 매트릭스 출력
  console.log('[스케줄] 결과 매트릭스:');
  matrix.forEach((row, t) => {
    const rowStr = row.map((v, g) => {
      if (v === null) return `${g+1}조:휴식`;
      return `${g+1}조:${recordTypes[v].short_name || recordTypes[v].name}`;
    }).join(', ');
    console.log(`  타임${t}: ${rowStr}`);
  });
  console.log(`[스케줄] 휴식 횟수: ${groupRestCount.map((c, g) => `${g+1}조:${c}회`).join(', ')}`);

  // 결과 변환
  const schedule = [];
  for (let t = 0; t < matrix.length; t++) {
    const assignments = [];
    for (let g = 0; g < G; g++) {
      const typeIdx = matrix[t][g];
      assignments.push({
        group_id: groups[g].id,
        record_type_id: typeIdx !== null ? recordTypes[typeIdx].record_type_id : null
      });
    }
    schedule.push({ time_order: t, assignments });
  }

  return schedule;
}

// 스케줄 조회
router.get('/:sessionId/schedule', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 세션 및 테스트 정보
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

    // 조 목록
    const [groups] = await pool.query(`
      SELECT * FROM test_groups WHERE test_session_id = ? ORDER BY group_num
    `, [sessionId]);

    // 종목 목록
    const [recordTypes] = await pool.query(`
      SELECT mtt.record_type_id, rt.name, rt.short_name, rt.unit
      FROM monthly_test_types mtt
      JOIN record_types rt ON mtt.record_type_id = rt.id
      WHERE mtt.monthly_test_id = ?
      ORDER BY mtt.display_order
    `, [session.monthly_test_id]);

    // 저장된 스케줄 조회
    const [savedSchedule] = await pool.query(`
      SELECT ss.*, rt.name as record_type_name, rt.short_name
      FROM session_schedules ss
      LEFT JOIN record_types rt ON ss.record_type_id = rt.id
      WHERE ss.test_session_id = ?
      ORDER BY ss.time_order, ss.group_id
    `, [sessionId]);

    // 스케줄을 타임별로 그룹화
    const scheduleByTime = {};
    let maxTimeOrder = -1;
    savedSchedule.forEach(s => {
      if (!scheduleByTime[s.time_order]) {
        scheduleByTime[s.time_order] = [];
      }
      scheduleByTime[s.time_order].push({
        group_id: s.group_id,
        record_type_id: s.record_type_id,
        record_type_name: s.record_type_name,
        short_name: s.short_name
      });
      if (s.time_order > maxTimeOrder) {
        maxTimeOrder = s.time_order;
      }
    });

    // 타임 수 계산 (저장된 스케줄 기준, 없으면 기본값)
    const numSlots = maxTimeOrder >= 0 ? maxTimeOrder + 1 : Math.max(groups.length, recordTypes.length);
    const timeSlots = [];
    for (let t = 0; t < numSlots; t++) {
      timeSlots.push({
        order: t,
        assignments: scheduleByTime[t] || []
      });
    }

    res.json({
      success: true,
      schedule: {
        groups,
        recordTypes,
        timeSlots,
        hasSchedule: savedSchedule.length > 0
      }
    });
  } catch (error) {
    console.error('스케줄 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 스케줄 생성/재생성
router.post('/:sessionId/schedule/generate', verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { sessionId } = req.params;

    // 세션 및 테스트 정보
    const [sessions] = await conn.query(`
      SELECT ts.*, mt.id as monthly_test_id
      FROM test_sessions ts
      JOIN monthly_tests mt ON ts.monthly_test_id = mt.id
      WHERE ts.id = ?
    `, [sessionId]);

    if (sessions.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    }

    const session = sessions[0];

    // 조 목록
    const [groups] = await conn.query(`
      SELECT * FROM test_groups WHERE test_session_id = ? ORDER BY group_num
    `, [sessionId]);

    if (groups.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: '조가 없습니다. 먼저 조를 편성하세요.' });
    }

    // 종목 목록
    const [recordTypes] = await conn.query(`
      SELECT mtt.record_type_id, rt.name, rt.short_name
      FROM monthly_test_types mtt
      JOIN record_types rt ON mtt.record_type_id = rt.id
      WHERE mtt.monthly_test_id = ?
      ORDER BY mtt.display_order
    `, [session.monthly_test_id]);

    if (recordTypes.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: '종목이 없습니다.' });
    }

    // 충돌 목록
    const [conflicts] = await conn.query(`
      SELECT record_type_id_1, record_type_id_2
      FROM record_type_conflicts
      WHERE monthly_test_id = ?
    `, [session.monthly_test_id]);

    console.log(`[스케줄 생성] 조: ${groups.length}개, 종목: ${recordTypes.length}개, 충돌: ${conflicts.length}개`);
    if (conflicts.length > 0) {
      console.log('[스케줄 생성] 충돌 목록:', conflicts.map(c => `${c.record_type_id_1}-${c.record_type_id_2}`).join(', '));
    }

    // 스케줄 생성
    const schedule = generateScheduleAlgorithm(groups, recordTypes, conflicts);

    // 기존 스케줄 삭제
    await conn.query('DELETE FROM session_schedules WHERE test_session_id = ?', [sessionId]);

    // 새 스케줄 저장
    const values = [];
    schedule.forEach(slot => {
      slot.assignments.forEach(a => {
        values.push([sessionId, a.group_id, slot.time_order, a.record_type_id]);
      });
    });

    if (values.length > 0) {
      await conn.query(`
        INSERT INTO session_schedules (test_session_id, group_id, time_order, record_type_id)
        VALUES ?
      `, [values]);
    }

    await conn.commit();

    res.json({
      success: true,
      message: '스케줄이 생성되었습니다.',
      schedule: {
        groups,
        recordTypes,
        timeSlots: schedule.map(s => ({
          order: s.time_order,
          assignments: s.assignments
        }))
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('스케줄 생성 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
