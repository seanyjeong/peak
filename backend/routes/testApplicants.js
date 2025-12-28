const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const pacaPool = require('../config/paca-database');
const { encrypt, decrypt } = require('../utils/encryption');

const ACADEMY_ID = 2;

// 테스트 신규 학생 목록 조회
router.get('/', async (req, res) => {
  try {
    const { month, status } = req.query;

    let query = `
      SELECT * FROM test_applicants
      WHERE academy_id = ?
    `;
    const params = [ACADEMY_ID];

    if (month) {
      query += ' AND test_month = ?';
      params.push(month);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const [applicants] = await pacaPool.query(query, params);

    // 이름/전화번호 복호화
    const decrypted = applicants.map(a => ({
      ...a,
      name: decrypt(a.name),
      phone: a.phone ? decrypt(a.phone) : null,
      gender: a.gender === 'male' ? 'M' : 'F'
    }));

    res.json({ success: true, applicants: decrypted });
  } catch (error) {
    console.error('테스트신규 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 테스트 신규 학생 등록
router.post('/', async (req, res) => {
  try {
    const { name, gender, phone, school, grade, test_month, test_date, notes } = req.body;

    // 이름/전화번호 암호화
    const encryptedName = encrypt(name);
    const encryptedPhone = phone ? encrypt(phone) : null;

    const dbGender = gender === 'M' || gender === 'male' ? 'male' : 'female';

    const [result] = await pacaPool.query(`
      INSERT INTO test_applicants
      (academy_id, name, gender, phone, school, grade, test_month, test_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [ACADEMY_ID, encryptedName, dbGender, encryptedPhone, school, grade, test_month, test_date, notes]);

    res.json({
      success: true,
      id: result.insertId,
      message: '테스트 신규 학생이 등록되었습니다.'
    });
  } catch (error) {
    console.error('테스트신규 등록 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 테스트 신규 학생 수정
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gender, phone, school, grade, notes, status } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(encrypt(name));
    }

    if (gender !== undefined) {
      updates.push('gender = ?');
      params.push(gender === 'M' || gender === 'male' ? 'male' : 'female');
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone ? encrypt(phone) : null);
    }

    if (school !== undefined) {
      updates.push('school = ?');
      params.push(school);
    }

    if (grade !== undefined) {
      updates.push('grade = ?');
      params.push(grade);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '수정할 내용이 없습니다.' });
    }

    params.push(id);

    await pacaPool.query(`
      UPDATE test_applicants SET ${updates.join(', ')} WHERE id = ?
    `, params);

    res.json({ success: true, message: '테스트 신규 학생 정보가 수정되었습니다.' });
  } catch (error) {
    console.error('테스트신규 수정 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 테스트 신규 학생 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 참가자에서도 제거
    await pool.query('DELETE FROM test_participants WHERE test_applicant_id = ?', [id]);

    // 기록도 삭제
    await pool.query('DELETE FROM test_records WHERE test_applicant_id = ?', [id]);

    // 테스트신규 삭제
    await pacaPool.query('DELETE FROM test_applicants WHERE id = ?', [id]);

    res.json({ success: true, message: '테스트 신규 학생이 삭제되었습니다.' });
  } catch (error) {
    console.error('테스트신규 삭제 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 정식 등록 전환
router.post('/:id/convert', async (req, res) => {
  const pacaConn = await pacaPool.getConnection();
  const peakConn = await pool.getConnection();

  try {
    await pacaConn.beginTransaction();
    await peakConn.beginTransaction();

    const { id } = req.params;

    // 테스트신규 정보 조회
    const [applicants] = await pacaConn.query(`
      SELECT * FROM test_applicants WHERE id = ?
    `, [id]);

    if (applicants.length === 0) {
      throw new Error('테스트 신규 학생을 찾을 수 없습니다.');
    }

    const applicant = applicants[0];

    if (applicant.status === 'registered') {
      throw new Error('이미 정식 등록된 학생입니다.');
    }

    // P-ACA students 테이블에 추가
    const [pacaResult] = await pacaConn.query(`
      INSERT INTO students (
        academy_id, name, gender, phone, school, grade,
        status, enrollment_type, enrollment_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'regular', CURDATE(), NOW())
    `, [
      ACADEMY_ID,
      applicant.name, // 이미 암호화됨
      applicant.gender,
      applicant.phone,
      applicant.school,
      applicant.grade
    ]);

    const pacaStudentId = pacaResult.insertId;

    // P-EAK students 테이블에 추가
    const [peakResult] = await peakConn.query(`
      INSERT INTO students (
        paca_student_id, name, gender, phone, school, grade, status, join_date
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', CURDATE())
    `, [
      pacaStudentId,
      decrypt(applicant.name),
      applicant.gender === 'male' ? 'M' : 'F',
      applicant.phone ? decrypt(applicant.phone) : null,
      applicant.school,
      applicant.grade
    ]);

    const peakStudentId = peakResult.insertId;

    // 테스트신규 상태 업데이트
    await pacaConn.query(`
      UPDATE test_applicants
      SET status = 'registered', converted_student_id = ?
      WHERE id = ?
    `, [pacaStudentId, id]);

    // test_records → student_records 마이그레이션
    const [testRecords] = await peakConn.query(`
      SELECT * FROM test_records WHERE test_applicant_id = ?
    `, [id]);

    for (const tr of testRecords) {
      await peakConn.query(`
        INSERT INTO student_records (student_id, record_type_id, value, measured_at, notes)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, [peakStudentId, tr.record_type_id, tr.value, tr.measured_at, tr.notes]);
    }

    // test_participants의 student_id 업데이트
    await peakConn.query(`
      UPDATE test_participants
      SET student_id = ?, test_applicant_id = NULL, participant_type = 'enrolled'
      WHERE test_applicant_id = ?
    `, [peakStudentId, id]);

    await pacaConn.commit();
    await peakConn.commit();

    res.json({
      success: true,
      message: '정식 등록이 완료되었습니다.',
      student_id: peakStudentId,
      paca_student_id: pacaStudentId
    });
  } catch (error) {
    await pacaConn.rollback();
    await peakConn.rollback();
    console.error('정식등록 전환 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    pacaConn.release();
    peakConn.release();
  }
});

// 휴원생 목록 조회 (수동 추가용)
router.get('/rest-students', async (req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT id, name, gender, school, grade
      FROM students
      WHERE status = 'inactive'
      ORDER BY name
    `);

    res.json({ success: true, students });
  } catch (error) {
    console.error('휴원생 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
