/**
 * 테스트 계정(academy_id=1)용 더미 데이터 생성
 * 연예인 이름 + 전국 고등학교
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

// P-ACA와 동일한 암호화 키
const DATA_ENCRYPTION_KEY = 'QQe/soOzfamoQhmoHQBQ32CM7qQHthbTs3yhE/qDem0=';

function getKey() {
  const key = DATA_ENCRYPTION_KEY;
  if (key.length === 32) {
    return Buffer.from(key, 'utf8');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(plaintext) {
  if (!plaintext || plaintext === '') return plaintext;
  if (typeof plaintext === 'string' && plaintext.startsWith('ENC:')) return plaintext;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return 'ENC:' + combined.toString('base64');
}

async function createDummyData() {
  const pacaPool = mysql.createPool({
    host: 'localhost',
    user: 'paca',
    password: 'q141171616!',
    database: 'paca'
  });

  const peakPool = mysql.createPool({
    host: 'localhost',
    user: 'paca',
    password: 'q141171616!',
    database: 'peak'
  });

  const ACADEMY_ID = 1; // 테스트 학원

  // 연예인 이름 학생 목록
  const celebrities = [
    { name: '아이유', gender: 'female', school: '서울공연예술고', grade: '고2' },
    { name: '박보검', gender: 'male', school: '부산예술고', grade: '고3' },
    { name: '김태리', gender: 'female', school: '서울예고', grade: '고2' },
    { name: '송강', gender: 'male', school: '인천예술고', grade: '고3' },
    { name: '전소미', gender: 'female', school: '서울공연예술고', grade: '고1' },
    { name: '차은우', gender: 'male', school: '서울공연예술고', grade: '고3' },
    { name: '윈터', gender: 'female', school: '부산예술고', grade: '고2' },
    { name: '카리나', gender: 'female', school: '서울예고', grade: '고2' },
    { name: '안효섭', gender: 'male', school: '대전예술고', grade: '고3' },
    { name: '김유정', gender: 'female', school: '서울공연예술고', grade: '고2' },
    { name: '뷔', gender: 'male', school: '대구예술고', grade: '고3' },
    { name: '제니', gender: 'female', school: '서울예고', grade: '고3' },
    { name: '수지', gender: 'female', school: '광주예술고', grade: '고2' },
    { name: '이준기', gender: 'male', school: '부산예술고', grade: '고3' },
    { name: '한소희', gender: 'female', school: '울산예술고', grade: '고2' },
  ];

  // 강사 목록
  const instructors = [
    { name: '김코치' },
    { name: '이트레이너' },
    { name: '박선생' },
    { name: '최강사' },
    { name: '정멘토' },
  ];

  console.log('=== P-ACA 학생 데이터 생성 ===');

  for (const student of celebrities) {
    const encryptedName = encrypt(student.name);
    const phone = `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const encryptedPhone = encrypt(phone);
    const classDays = JSON.stringify([1, 3, 5]); // 월수금

    try {
      const [result] = await pacaPool.query(`
        INSERT INTO students (
          academy_id, name, gender, phone, school, grade,
          class_days, status, enrollment_date, monthly_tuition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURDATE(), 300000)
      `, [ACADEMY_ID, encryptedName, student.gender, encryptedPhone, student.school, student.grade, classDays]);

      console.log(`✓ 학생 추가: ${student.name} (ID: ${result.insertId})`);

      // P-EAK에도 동기화
      await peakPool.query(`
        INSERT INTO students (
          academy_id, paca_student_id, name, gender, phone, school, grade,
          class_days, status, join_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURDATE())
      `, [ACADEMY_ID, result.insertId, student.name, student.gender === 'male' ? 'M' : 'F', phone, student.school, student.grade, classDays]);

    } catch (err) {
      console.error(`✗ 학생 추가 실패: ${student.name}`, err.message);
    }
  }

  console.log('\n=== P-ACA 강사 데이터 생성 ===');

  for (const instructor of instructors) {
    const encryptedName = encrypt(instructor.name);

    try {
      const [result] = await pacaPool.query(`
        INSERT INTO instructors (
          academy_id, name, status, created_at
        ) VALUES (?, ?, 'active', NOW())
      `, [ACADEMY_ID, encryptedName]);

      console.log(`✓ 강사 추가: ${instructor.name} (ID: ${result.insertId})`);
    } catch (err) {
      console.error(`✗ 강사 추가 실패: ${instructor.name}`, err.message);
    }
  }

  console.log('\n=== 완료 ===');

  await pacaPool.end();
  await peakPool.end();
}

createDummyData().catch(console.error);
