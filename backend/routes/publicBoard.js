const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const pacaPool = require('../config/paca-database');
const { decrypt } = require('../utils/encryption');

// 점수 계산 함수
const calculateScore = (value, scoreRanges, gender) => {
  if (!value || !scoreRanges || scoreRanges.length === 0) return 0;

  const genderKey = gender === 'M' ? 'male' : 'female';

  for (const range of scoreRanges) {
    const min = range[`${genderKey}_min`];
    const max = range[`${genderKey}_max`];

    if (min !== null && max !== null) {
      if (value >= min && value <= max) {
        return range.score;
      }
    } else if (min !== null && value >= min) {
      return range.score;
    } else if (max !== null && value <= max) {
      return range.score;
    }
  }

  return 0;
};

// 전광판 데이터 조회 (인증 불필요)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // 1. P-EAK 설정에서 학원 정보 조회 (P-ACA와 분리된 slug)
    const [settings] = await pool.query(`
      SELECT academy_id, slug, academy_name FROM peak_settings WHERE slug = ?
    `, [slug]);

    if (settings.length === 0) {
      return res.status(404).json({ success: false, message: '학원을 찾을 수 없습니다.' });
    }

    const academy = {
      id: settings[0].academy_id,
      name: settings[0].academy_name,
      slug: settings[0].slug
    };

    // 2. 현재 active인 월말테스트 조회
    const academyId = academy.id;

    const [tests] = await pool.query(`
      SELECT id, test_month, test_name, status
      FROM monthly_tests
      WHERE status = 'active' AND academy_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [academyId]);

    if (tests.length === 0) {
      return res.json({
        success: true,
        academy: { name: academy.name, slug: academy.slug },
        test: null,
        message: '현재 진행 중인 테스트가 없습니다.'
      });
    }

    const test = tests[0];

    // 3. 테스트 종목 조회
    const [recordTypes] = await pool.query(`
      SELECT mtt.record_type_id, rt.name, rt.short_name, rt.unit, rt.direction
      FROM monthly_test_types mtt
      JOIN record_types rt ON mtt.record_type_id = rt.id
      WHERE mtt.monthly_test_id = ?
      ORDER BY mtt.display_order
    `, [test.id]);

    // 4. 배점표 조회
    const recordTypeIds = recordTypes.map(rt => rt.record_type_id);
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
          scoreRangesMap[sr.record_type_id].push(sr);
        });
      }
    }

    // 5. 모든 세션의 참가자 조회
    const [sessions] = await pool.query(`
      SELECT id, test_date FROM test_sessions WHERE monthly_test_id = ?
    `, [test.id]);

    const sessionIds = sessions.map(s => s.id);

    if (sessionIds.length === 0) {
      return res.json({
        success: true,
        academy: { name: academy.name, slug: academy.slug },
        test: { name: test.test_name, month: test.test_month },
        ranking: { male: [], female: [] },
        events: []
      });
    }

    // 6. 참가자 + 기록 조회
    const [participants] = await pool.query(`
      SELECT tp.id, tp.student_id, tp.test_applicant_id, tp.participant_type,
             s.name, s.gender, s.school, s.grade
      FROM test_participants tp
      LEFT JOIN students s ON tp.student_id = s.id
      WHERE tp.test_session_id IN (?)
    `, [sessionIds]);

    // 테스트신규 정보 조회
    const testApplicantIds = participants
      .filter(p => p.test_applicant_id)
      .map(p => p.test_applicant_id);

    let applicantMap = {};
    if (testApplicantIds.length > 0) {
      const [applicants] = await pacaPool.query(`
        SELECT id, name, gender, school, grade FROM test_applicants WHERE id IN (?)
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

    // 7. 기록 조회 (student_records + test_records) - 테스트 세션 날짜 기준
    const studentIds = participants.filter(p => p.student_id).map(p => p.student_id);
    const testDates = sessions.map(s => s.test_date);
    let studentRecords = {};

    if (studentIds.length > 0 && recordTypeIds.length > 0 && testDates.length > 0) {
      const [records] = await pool.query(`
        SELECT student_id, record_type_id, value
        FROM student_records
        WHERE student_id IN (?) AND record_type_id IN (?) AND measured_at IN (?)
        ORDER BY measured_at DESC
      `, [studentIds, recordTypeIds, testDates]);

      records.forEach(r => {
        if (!studentRecords[r.student_id]) studentRecords[r.student_id] = {};
        if (!studentRecords[r.student_id][r.record_type_id]) {
          studentRecords[r.student_id][r.record_type_id] = r.value;
        }
      });
    }

    // 테스트신규 기록
    let applicantRecords = {};
    if (testApplicantIds.length > 0 && recordTypeIds.length > 0) {
      const [records] = await pool.query(`
        SELECT test_applicant_id, record_type_id, value
        FROM test_records
        WHERE test_session_id IN (?) AND test_applicant_id IN (?) AND record_type_id IN (?)
      `, [sessionIds, testApplicantIds, recordTypeIds]);

      records.forEach(r => {
        if (!applicantRecords[r.test_applicant_id]) applicantRecords[r.test_applicant_id] = {};
        applicantRecords[r.test_applicant_id][r.record_type_id] = r.value;
      });
    }

    // 8. 참가자별 총점 계산
    const participantData = participants.map(p => {
      let info, records;

      if (p.student_id) {
        info = {
          name: p.name,
          gender: p.gender,
          school: p.school,
          grade: p.grade
        };
        records = studentRecords[p.student_id] || {};
      } else if (p.test_applicant_id && applicantMap[p.test_applicant_id]) {
        info = applicantMap[p.test_applicant_id];
        records = applicantRecords[p.test_applicant_id] || {};
      } else {
        return null;
      }

      // 종목별 점수 계산
      let totalScore = 0;
      const eventScores = {};

      recordTypes.forEach(rt => {
        const value = records[rt.record_type_id];
        if (value !== undefined) {
          const score = calculateScore(
            parseFloat(value),
            scoreRangesMap[rt.record_type_id] || [],
            info.gender
          );
          eventScores[rt.record_type_id] = { value: parseFloat(value), score };
          totalScore += score;
        }
      });

      return {
        ...info,
        records,
        eventScores,
        totalScore
      };
    }).filter(Boolean);

    // 9. 종합순위 (남/여 분리, TOP 10) - 점수 0인 참가자 제외
    const maleRanking = participantData
      .filter(p => p.gender === 'M' && p.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        school: p.school,
        grade: p.grade,
        total: p.totalScore
      }));

    const femaleRanking = participantData
      .filter(p => p.gender === 'F' && p.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        school: p.school,
        grade: p.grade,
        total: p.totalScore
      }));

    // 10. 종목별 순위 (남/여 각각 10명씩)
    const events = recordTypes.map(rt => {
      const allRecords = participantData
        .filter(p => p.eventScores[rt.record_type_id])
        .map(p => ({
          name: p.name,
          gender: p.gender,
          school: p.school,
          value: p.eventScores[rt.record_type_id].value,
          score: p.eventScores[rt.record_type_id].score
        }));

      const sortFn = rt.direction === 'lower'
        ? (a, b) => a.value - b.value
        : (a, b) => b.value - a.value;

      // 남녀 각각 10명씩
      const maleRecords = allRecords
        .filter(r => r.gender === 'M')
        .sort(sortFn)
        .slice(0, 10)
        .map((p, idx) => ({ rank: idx + 1, ...p }));

      const femaleRecords = allRecords
        .filter(r => r.gender === 'F')
        .sort(sortFn)
        .slice(0, 10)
        .map((p, idx) => ({ rank: idx + 1, ...p }));

      return {
        id: rt.record_type_id,
        name: rt.name,
        shortName: rt.short_name,
        unit: rt.unit,
        records: [...maleRecords, ...femaleRecords]
      };
    });

    res.json({
      success: true,
      academy: { name: academy.name, slug: academy.slug },
      test: { name: test.test_name, month: test.test_month },
      ranking: { male: maleRanking, female: femaleRanking },
      events
    });

  } catch (error) {
    console.error('전광판 데이터 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 배점표 조회 (인증 불필요)
router.get('/:slug/scores', async (req, res) => {
  try {
    const { slug } = req.params;

    // 1. P-EAK 설정에서 학원 정보 조회
    const [settings] = await pool.query(`
      SELECT academy_id, slug, academy_name FROM peak_settings WHERE slug = ?
    `, [slug]);

    if (settings.length === 0) {
      return res.status(404).json({ success: false, message: '학원을 찾을 수 없습니다.' });
    }

    const academy = {
      id: settings[0].academy_id,
      name: settings[0].academy_name,
      slug: settings[0].slug
    };

    // 2. 배점표 조회 (활성화된 종목만)
    const [scoreTables] = await pool.query(`
      SELECT st.*, rt.name as record_type_name, rt.short_name, rt.unit, rt.direction
      FROM score_tables st
      JOIN record_types rt ON st.record_type_id = rt.id
      WHERE st.academy_id = ? AND st.is_active = 1
      ORDER BY rt.display_order
    `, [academy.id]);

    // 3. 각 배점표의 점수 범위 조회
    const scoreTableIds = scoreTables.map(st => st.id);
    let rangesMap = {};

    if (scoreTableIds.length > 0) {
      const [ranges] = await pool.query(`
        SELECT * FROM score_ranges
        WHERE score_table_id IN (?)
        ORDER BY score DESC
      `, [scoreTableIds]);

      ranges.forEach(r => {
        if (!rangesMap[r.score_table_id]) {
          rangesMap[r.score_table_id] = [];
        }
        rangesMap[r.score_table_id].push(r);
      });
    }

    // 4. 응답 데이터 구성
    const tables = scoreTables.map(st => ({
      id: st.id,
      recordType: {
        id: st.record_type_id,
        name: st.record_type_name,
        shortName: st.short_name,
        unit: st.unit,
        direction: st.direction
      },
      maxScore: st.max_score,
      minScore: st.min_score,
      scoreStep: st.score_step,
      decimalPlaces: st.decimal_places,
      malePerfect: parseFloat(st.male_perfect),
      femalePerfect: parseFloat(st.female_perfect),
      ranges: (rangesMap[st.id] || []).map(r => ({
        score: r.score,
        male: { min: parseFloat(r.male_min), max: parseFloat(r.male_max) },
        female: { min: parseFloat(r.female_min), max: parseFloat(r.female_max) }
      }))
    }));

    res.json({
      success: true,
      academy: { name: academy.name, slug: academy.slug },
      scoreTables: tables
    });

  } catch (error) {
    console.error('배점표 조회 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
