-- Fix: trainers academy guard referenced paca.users, but trainers.paca_user_id
-- actually holds paca.instructors.id (owner rows use negative -users.id).
-- Wrong reference froze academy 1/2 sync since 2026-06-02. Repoint to paca.instructors.
DROP TRIGGER IF EXISTS before_trainers_insert_academy_guard;
DROP TRIGGER IF EXISTS before_trainers_update_academy_guard;

DELIMITER //

CREATE TRIGGER before_trainers_insert_academy_guard
BEFORE INSERT ON trainers
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.instructors
  WHERE id = NEW.paca_user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'trainers academy scope violation';
  END IF;
END//

CREATE TRIGGER before_trainers_update_academy_guard
BEFORE UPDATE ON trainers
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.instructors
  WHERE id = NEW.paca_user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'trainers academy scope violation';
  END IF;
END//

DELIMITER ;
