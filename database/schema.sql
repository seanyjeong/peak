-- P-EAK Database Schema
-- 체육 실기 훈련 관리 시스템

CREATE DATABASE IF NOT EXISTS peak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE peak;

-- ==========================================
-- 트레이너 (P-ACA users와 연동)
-- ==========================================
CREATE TABLE IF NOT EXISTS trainers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paca_user_id INT NOT NULL COMMENT 'P-ACA users.id',
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_paca_user (paca_user_id),
    INDEX idx_active (active)
) ENGINE=InnoDB;

-- ==========================================
-- 학생 (P-ACA students와 동기화)
-- ==========================================
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paca_student_id INT NOT NULL COMMENT 'P-ACA students.id',
    name VARCHAR(100) NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    phone VARCHAR(20),
    join_date DATE,
    status ENUM('active', 'inactive', 'injury') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_paca_student (paca_student_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ==========================================
-- 학생 기록 (정기 측정 - 4대 종목)
-- ==========================================
CREATE TABLE IF NOT EXISTS student_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    measured_at DATE NOT NULL COMMENT '측정 날짜',
    standing_jump DECIMAL(5,1) COMMENT '제자리멀리뛰기 (cm)',
    medicine_ball DECIMAL(4,2) COMMENT '메디신볼 던지기 (m)',
    shuttle_run DECIMAL(4,2) COMMENT '20m 왕복달리기 (초)',
    flexibility DECIMAL(4,1) COMMENT '좌전굴 (cm)',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_student_date (student_id, measured_at)
) ENGINE=InnoDB;

-- ==========================================
-- 일일 출근 (트레이너)
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    trainer_id INT NOT NULL,
    check_in_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_date_trainer (date, trainer_id),
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- ==========================================
-- 일일 훈련 계획
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    trainer_id INT NOT NULL,
    tags JSON COMMENT '훈련 태그 ["하체파워", "민첩성"]',
    description TEXT COMMENT '자유 텍스트 설명',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
    INDEX idx_date_trainer (date, trainer_id)
) ENGINE=InnoDB;

-- ==========================================
-- 반 배치 (핵심! 드래그앤드롭)
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    student_id INT NOT NULL,
    trainer_id INT COMMENT 'NULL = 미배정',
    status ENUM('training', 'rest', 'injury') DEFAULT 'training',
    order_num INT DEFAULT 0 COMMENT '드래그 순서',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_date_student (date, student_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL,
    INDEX idx_date (date),
    INDEX idx_trainer (trainer_id)
) ENGINE=InnoDB;

-- ==========================================
-- 훈련 기록 (학생별)
-- ==========================================
CREATE TABLE IF NOT EXISTS training_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    student_id INT NOT NULL,
    trainer_id INT NOT NULL,
    plan_id INT COMMENT 'daily_plans 참조',
    condition_score TINYINT COMMENT '컨디션 1~5',
    notes TEXT COMMENT '개인 메모',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES daily_plans(id) ON DELETE SET NULL,
    INDEX idx_date_student (date, student_id),
    INDEX idx_trainer (trainer_id)
) ENGINE=InnoDB;

-- ==========================================
-- 초기 데이터 (훈련 태그)
-- ==========================================
-- 태그는 프론트엔드에서 상수로 관리
-- ['하체파워', '상체파워', '민첩성', '유연성', '기술/자세', '컨디셔닝']
