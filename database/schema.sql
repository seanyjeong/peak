-- P-EAK Database Schema (Current Implementation)
-- Updated based on backend code analysis
-- Supports Multi-tenancy (academy_id) and Dynamic Record Types

CREATE DATABASE IF NOT EXISTS peak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE peak;

-- ==========================================
-- 1. 학생 관리 (P-ACA 연동)
-- ==========================================
-- 로컬 캐시 역할. 실제 원본은 P-ACA DB에 있음.
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    paca_student_id INT NOT NULL COMMENT 'P-ACA students.id 링크',
    name VARCHAR(100) NOT NULL COMMENT '암호화된 이름 (일부 로직에서 복호화 사용)',
    gender ENUM('M', 'F') DEFAULT 'M',
    phone VARCHAR(100),
    school VARCHAR(100),
    grade VARCHAR(20),
    class_days JSON COMMENT '수업 요일 [0,1,2,3,4,5,6]',
    status ENUM('active', 'inactive', 'injury', 'paused', 'pending') DEFAULT 'active',
    is_trial TINYINT(1) DEFAULT 0 COMMENT '체험생 여부',
    trial_total INT DEFAULT 0 COMMENT '체험 총 횟수',
    trial_remaining INT DEFAULT 0 COMMENT '남은 체험 횟수',
    join_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_academy_paca (academy_id, paca_student_id),
    INDEX idx_academy_status (academy_id, status)
) ENGINE=InnoDB;

-- ==========================================
-- 2. 측정 종목 관리 (Dynamic Records)
-- ==========================================
CREATE TABLE IF NOT EXISTS record_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    unit VARCHAR(20) COMMENT 'cm, m, sec, kg, etc.',
    direction ENUM('higher', 'lower') DEFAULT 'higher' COMMENT 'higher: 높을수록 좋음, lower: 낮을수록 좋음',
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_academy_active (academy_id, is_active)
) ENGINE=InnoDB;

-- ==========================================
-- 3. 학생 기록 (Measurements)
-- ==========================================
CREATE TABLE IF NOT EXISTS student_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    student_id INT NOT NULL,
    record_type_id INT NOT NULL,
    measured_at DATE NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (record_type_id) REFERENCES record_types(id) ON DELETE CASCADE,
    INDEX idx_student_record_date (student_id, record_type_id, measured_at),
    INDEX idx_academy_date (academy_id, measured_at)
) ENGINE=InnoDB;

-- ==========================================
-- 4. 운동 라이브러리 (Exercises)
-- ==========================================
CREATE TABLE IF NOT EXISTS exercises (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    tags JSON COMMENT '["하체", "맨몸"]',
    default_sets INT,
    default_reps INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_academy (academy_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exercise_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    tag_id VARCHAR(50) NOT NULL,
    label VARCHAR(50) NOT NULL,
    color VARCHAR(50) DEFAULT 'bg-slate-100 text-slate-700',
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    UNIQUE KEY uk_academy_tag (academy_id, tag_id)
) ENGINE=InnoDB;

-- ==========================================
-- 5. 운동 팩 (Exercise Packs - Preset)
-- ==========================================
CREATE TABLE IF NOT EXISTS exercise_packs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    author VARCHAR(100),
    snapshot_data JSON COMMENT '팩 생성 시점의 운동 데이터 스냅샷',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_academy (academy_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exercise_pack_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pack_id INT NOT NULL,
    exercise_id INT NOT NULL,
    display_order INT DEFAULT 0,
    FOREIGN KEY (pack_id) REFERENCES exercise_packs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 6. 수업 계획 (Daily Plans)
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL COMMENT 'morning, afternoon, evening',
    trainer_id INT NOT NULL COMMENT '작성자 (P-ACA instructor_id)',
    instructor_id INT NOT NULL COMMENT '담당 강사 (P-ACA instructor_id)',
    tags JSON COMMENT '수업 태그',
    exercises JSON COMMENT '계획된 운동 목록',
    description TEXT,
    completed_exercises JSON COMMENT '완료된 운동 ID 목록',
    extra_exercises JSON COMMENT '추가된 운동 목록',
    exercise_times JSON COMMENT '운동 완료 시간 기록',
    temperature DECIMAL(4,1),
    humidity DECIMAL(4,1),
    conditions_checked TINYINT(1) DEFAULT 0,
    conditions_checked_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_academy_date (academy_id, date, time_slot)
) ENGINE=InnoDB;

-- ==========================================
-- 7. 반 배치 및 출석 (Assignments & Attendance)
-- ==========================================
-- 반별 강사 배치
CREATE TABLE IF NOT EXISTS class_instructors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    class_num INT NOT NULL COMMENT '1반, 2반...',
    instructor_id INT NOT NULL COMMENT 'P-ACA instructor_id',
    is_main TINYINT(1) DEFAULT 0 COMMENT '주강사 여부',
    order_num INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_schedule (academy_id, date, time_slot, class_num)
) ENGINE=InnoDB;

-- 학생 반 배정
CREATE TABLE IF NOT EXISTS daily_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    student_id INT NOT NULL,
    paca_attendance_id INT COMMENT 'P-ACA attendance.id 링크',
    class_id INT COMMENT '배정된 반 번호 (class_num). NULL이면 대기',
    status ENUM('enrolled', 'training', 'rest', 'injury') DEFAULT 'enrolled',
    order_num INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_schedule (academy_id, date, time_slot)
) ENGINE=InnoDB;

-- 강사 출근 체크 (로컬)
CREATE TABLE IF NOT EXISTS daily_attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    date DATE NOT NULL,
    trainer_id INT NOT NULL COMMENT 'P-ACA instructor_id',
    check_in_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_academy_date (academy_id, date)
) ENGINE=InnoDB;

-- ==========================================
-- 8. 훈련 일지 (Training Logs - Individual)
-- ==========================================
CREATE TABLE IF NOT EXISTS training_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    date DATE NOT NULL,
    student_id INT NOT NULL,
    trainer_id INT NOT NULL COMMENT 'P-ACA instructor_id',
    plan_id INT COMMENT 'daily_plans.id',
    condition_score TINYINT COMMENT '1~5 점수',
    notes TEXT,
    temperature DECIMAL(4,1),
    humidity DECIMAL(4,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES daily_plans(id) ON DELETE SET NULL,
    INDEX idx_academy_date_student (academy_id, date, student_id)
) ENGINE=InnoDB;

-- ==========================================
-- 9. 월말 테스트 (Monthly Tests & Scoreboard)
-- ==========================================
CREATE TABLE IF NOT EXISTS monthly_tests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    test_month VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
    test_name VARCHAR(100) NOT NULL,
    status ENUM('active', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_academy_status (academy_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS monthly_test_types (
    monthly_test_id INT NOT NULL,
    record_type_id INT NOT NULL,
    display_order INT DEFAULT 0,
    PRIMARY KEY (monthly_test_id, record_type_id),
    FOREIGN KEY (monthly_test_id) REFERENCES monthly_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (record_type_id) REFERENCES record_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 배점표
CREATE TABLE IF NOT EXISTS score_tables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    record_type_id INT NOT NULL,
    max_score INT DEFAULT 100,
    min_score INT DEFAULT 0,
    score_step INT DEFAULT 5,
    value_step DECIMAL(10,2) DEFAULT 1.00,
    male_perfect DECIMAL(10,2),
    female_perfect DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_type_id) REFERENCES record_types(id) ON DELETE CASCADE,
    INDEX idx_academy_type (academy_id, record_type_id)
) ENGINE=InnoDB;

-- 배점 구간
CREATE TABLE IF NOT EXISTS score_ranges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    score_table_id INT NOT NULL,
    record_type_id INT NOT NULL,
    score INT NOT NULL,
    male_min DECIMAL(10,2),
    male_max DECIMAL(10,2),
    female_min DECIMAL(10,2),
    female_max DECIMAL(10,2),
    FOREIGN KEY (score_table_id) REFERENCES score_tables(id) ON DELETE CASCADE,
    INDEX idx_table_score (score_table_id, score)
) ENGINE=InnoDB;

-- 테스트 세션 (날짜)
CREATE TABLE IF NOT EXISTS test_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    monthly_test_id INT NOT NULL,
    test_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monthly_test_id) REFERENCES monthly_tests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 테스트 참가자
CREATE TABLE IF NOT EXISTS test_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    test_session_id INT NOT NULL,
    student_id INT COMMENT '내부 재원생인 경우',
    test_applicant_id INT COMMENT '외부 테스트 신청자인 경우 (P-ACA test_applicants.id)',
    participant_type ENUM('student', 'applicant') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 외부 참가자 기록 (재원생은 student_records 사용)
CREATE TABLE IF NOT EXISTS test_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    test_session_id INT NOT NULL,
    test_applicant_id INT NOT NULL,
    record_type_id INT NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (record_type_id) REFERENCES record_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;