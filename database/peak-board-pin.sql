-- Peak 전광판 PIN 보호 컬럼 추가
-- 기존 peak_settings 데이터는 변경하지 않고 컬럼만 추가한다.

SET @has_board_pin_hash := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'peak_settings'
    AND COLUMN_NAME = 'board_pin_hash'
);

SET @add_board_pin_hash := IF(
  @has_board_pin_hash = 0,
  'ALTER TABLE peak_settings ADD COLUMN board_pin_hash VARCHAR(255) NULL AFTER academy_name',
  'SELECT 1'
);

PREPARE add_board_pin_hash_stmt FROM @add_board_pin_hash;
EXECUTE add_board_pin_hash_stmt;
DEALLOCATE PREPARE add_board_pin_hash_stmt;

SET @has_board_pin_updated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'peak_settings'
    AND COLUMN_NAME = 'board_pin_updated_at'
);

SET @add_board_pin_updated_at := IF(
  @has_board_pin_updated_at = 0,
  'ALTER TABLE peak_settings ADD COLUMN board_pin_updated_at DATETIME NULL AFTER board_pin_hash',
  'SELECT 1'
);

PREPARE add_board_pin_updated_at_stmt FROM @add_board_pin_updated_at;
EXECUTE add_board_pin_updated_at_stmt;
DEALLOCATE PREPARE add_board_pin_updated_at_stmt;
