-- Peak 전광판 테마(1~5) 컬럼 추가
-- 기존 peak_settings 데이터는 변경하지 않고 컬럼만 추가한다. 기본값 1(스포츠 중계).

SET @has_board_theme := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'peak_settings'
    AND COLUMN_NAME = 'board_theme'
);

SET @add_board_theme := IF(
  @has_board_theme = 0,
  'ALTER TABLE peak_settings ADD COLUMN board_theme TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER board_pin_updated_at',
  'SELECT 1'
);

PREPARE add_board_theme_stmt FROM @add_board_theme;
EXECUTE add_board_theme_stmt;
DEALLOCATE PREPARE add_board_theme_stmt;
