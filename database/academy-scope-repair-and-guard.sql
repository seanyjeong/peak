-- Peak academy scope repair and guard.
-- Run against the `peak` schema after taking an external DB backup.

CREATE TABLE IF NOT EXISTS academy_scope_repair_20260602_test_sessions AS
SELECT ts.*
FROM test_sessions ts
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
WHERE ts.academy_id <> mt.academy_id;

CREATE TABLE IF NOT EXISTS academy_scope_repair_20260602_test_groups AS
SELECT tg.*
FROM test_groups tg
JOIN test_sessions ts ON ts.id = tg.test_session_id
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
WHERE tg.academy_id <> mt.academy_id;

CREATE TABLE IF NOT EXISTS academy_scope_repair_20260602_test_participants AS
SELECT tp.*
FROM test_participants tp
JOIN test_sessions ts ON ts.id = tp.test_session_id
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
WHERE tp.academy_id <> mt.academy_id;

CREATE TABLE IF NOT EXISTS academy_scope_repair_20260602_test_records AS
SELECT tr.*
FROM test_records tr
JOIN test_sessions ts ON ts.id = tr.test_session_id
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
WHERE tr.academy_id <> mt.academy_id;

UPDATE test_sessions ts
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
SET ts.academy_id = mt.academy_id
WHERE ts.academy_id <> mt.academy_id;

UPDATE test_groups tg
JOIN test_sessions ts ON ts.id = tg.test_session_id
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
SET tg.academy_id = mt.academy_id
WHERE tg.academy_id <> mt.academy_id;

UPDATE test_participants tp
JOIN test_sessions ts ON ts.id = tp.test_session_id
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
SET tp.academy_id = mt.academy_id
WHERE tp.academy_id <> mt.academy_id;

UPDATE test_records tr
JOIN test_sessions ts ON ts.id = tr.test_session_id
JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
SET tr.academy_id = mt.academy_id
WHERE tr.academy_id <> mt.academy_id;

UPDATE students s
JOIN paca.students ps ON ps.id = s.paca_student_id
SET s.academy_id = ps.academy_id
WHERE s.academy_id <> ps.academy_id;

UPDATE push_subscriptions ps
JOIN paca.users u ON u.id = ps.user_id
SET ps.academy_id = u.academy_id
WHERE ps.academy_id <> u.academy_id;

UPDATE notifications n
JOIN paca.users u ON u.id = n.user_id
SET n.academy_id = u.academy_id
WHERE n.academy_id <> u.academy_id;

UPDATE trainers t
JOIN paca.users u ON u.id = t.paca_user_id
SET t.academy_id = u.academy_id
WHERE t.academy_id <> u.academy_id;

ALTER TABLE class_instructors MODIFY academy_id INT NOT NULL;
ALTER TABLE daily_assignments MODIFY academy_id INT NOT NULL;
ALTER TABLE daily_attendance MODIFY academy_id INT NOT NULL;
ALTER TABLE daily_plans MODIFY academy_id INT NOT NULL;
ALTER TABLE exercise_tags MODIFY academy_id INT NOT NULL;
ALTER TABLE monthly_tests MODIFY academy_id INT NOT NULL;
ALTER TABLE notifications MODIFY academy_id INT NOT NULL;
ALTER TABLE peak_settings MODIFY academy_id INT NOT NULL;
ALTER TABLE push_subscriptions MODIFY academy_id INT NOT NULL;
ALTER TABLE record_type_conflicts MODIFY academy_id INT NOT NULL;
ALTER TABLE record_types MODIFY academy_id INT NOT NULL;
ALTER TABLE score_tables MODIFY academy_id INT NOT NULL;
ALTER TABLE student_records MODIFY academy_id INT NOT NULL;
ALTER TABLE students MODIFY academy_id INT NOT NULL;
ALTER TABLE test_groups MODIFY academy_id INT NOT NULL;
ALTER TABLE test_participants MODIFY academy_id INT NOT NULL;
ALTER TABLE test_records MODIFY academy_id INT NOT NULL;
ALTER TABLE test_sessions MODIFY academy_id INT NOT NULL;
ALTER TABLE trainers MODIFY academy_id INT NOT NULL;
ALTER TABLE training_logs MODIFY academy_id INT NOT NULL;

ALTER TABLE exercise_tags DROP INDEX tag_id;
ALTER TABLE exercise_tags ADD UNIQUE KEY uk_exercise_tags_academy_tag (academy_id, tag_id);

DROP TRIGGER IF EXISTS before_students_insert_academy_guard;
DROP TRIGGER IF EXISTS before_students_update_academy_guard;
DROP TRIGGER IF EXISTS before_test_sessions_insert_academy_guard;
DROP TRIGGER IF EXISTS before_test_sessions_update_academy_guard;
DROP TRIGGER IF EXISTS before_test_groups_insert_academy_guard;
DROP TRIGGER IF EXISTS before_test_groups_update_academy_guard;
DROP TRIGGER IF EXISTS before_test_participants_insert_academy_guard;
DROP TRIGGER IF EXISTS before_test_participants_update_academy_guard;
DROP TRIGGER IF EXISTS before_test_records_insert_academy_guard;
DROP TRIGGER IF EXISTS before_test_records_update_academy_guard;
DROP TRIGGER IF EXISTS before_push_subscriptions_insert_academy_guard;
DROP TRIGGER IF EXISTS before_push_subscriptions_update_academy_guard;
DROP TRIGGER IF EXISTS before_notifications_insert_academy_guard;
DROP TRIGGER IF EXISTS before_notifications_update_academy_guard;
DROP TRIGGER IF EXISTS before_trainers_insert_academy_guard;
DROP TRIGGER IF EXISTS before_trainers_update_academy_guard;

DELIMITER //

CREATE TRIGGER before_students_insert_academy_guard
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.students
  WHERE id = NEW.paca_student_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'students academy scope violation';
  END IF;
END//

CREATE TRIGGER before_students_update_academy_guard
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.students
  WHERE id = NEW.paca_student_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'students academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_sessions_insert_academy_guard
BEFORE INSERT ON test_sessions
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM monthly_tests
  WHERE id = NEW.monthly_test_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_sessions academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_sessions_update_academy_guard
BEFORE UPDATE ON test_sessions
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM monthly_tests
  WHERE id = NEW.monthly_test_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_sessions academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_groups_insert_academy_guard
BEFORE INSERT ON test_groups
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT mt.academy_id INTO expected_academy_id
  FROM test_sessions ts
  JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
  WHERE ts.id = NEW.test_session_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_groups academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_groups_update_academy_guard
BEFORE UPDATE ON test_groups
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT mt.academy_id INTO expected_academy_id
  FROM test_sessions ts
  JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
  WHERE ts.id = NEW.test_session_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_groups academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_participants_insert_academy_guard
BEFORE INSERT ON test_participants
FOR EACH ROW
BEGIN
  DECLARE session_academy_id INT;
  DECLARE student_academy_id INT;
  DECLARE applicant_academy_id INT;

  SELECT mt.academy_id INTO session_academy_id
  FROM test_sessions ts
  JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
  WHERE ts.id = NEW.test_session_id;

  IF NEW.student_id IS NOT NULL THEN
    SELECT academy_id INTO student_academy_id FROM students WHERE id = NEW.student_id;
  END IF;

  IF NEW.test_applicant_id IS NOT NULL THEN
    SELECT academy_id INTO applicant_academy_id FROM paca.test_applicants WHERE id = NEW.test_applicant_id;
  END IF;

  IF session_academy_id IS NOT NULL AND NEW.academy_id <> session_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_participants session academy scope violation';
  END IF;
  IF student_academy_id IS NOT NULL AND NEW.academy_id <> student_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_participants student academy scope violation';
  END IF;
  IF applicant_academy_id IS NOT NULL AND NEW.academy_id <> applicant_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_participants applicant academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_participants_update_academy_guard
BEFORE UPDATE ON test_participants
FOR EACH ROW
BEGIN
  DECLARE session_academy_id INT;
  DECLARE student_academy_id INT;
  DECLARE applicant_academy_id INT;

  SELECT mt.academy_id INTO session_academy_id
  FROM test_sessions ts
  JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
  WHERE ts.id = NEW.test_session_id;

  IF NEW.student_id IS NOT NULL THEN
    SELECT academy_id INTO student_academy_id FROM students WHERE id = NEW.student_id;
  END IF;

  IF NEW.test_applicant_id IS NOT NULL THEN
    SELECT academy_id INTO applicant_academy_id FROM paca.test_applicants WHERE id = NEW.test_applicant_id;
  END IF;

  IF session_academy_id IS NOT NULL AND NEW.academy_id <> session_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_participants session academy scope violation';
  END IF;
  IF student_academy_id IS NOT NULL AND NEW.academy_id <> student_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_participants student academy scope violation';
  END IF;
  IF applicant_academy_id IS NOT NULL AND NEW.academy_id <> applicant_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_participants applicant academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_records_insert_academy_guard
BEFORE INSERT ON test_records
FOR EACH ROW
BEGIN
  DECLARE session_academy_id INT;
  DECLARE student_academy_id INT;
  DECLARE applicant_academy_id INT;

  SELECT mt.academy_id INTO session_academy_id
  FROM test_sessions ts
  JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
  WHERE ts.id = NEW.test_session_id;

  IF NEW.student_id IS NOT NULL THEN
    SELECT academy_id INTO student_academy_id FROM students WHERE id = NEW.student_id;
  END IF;

  IF NEW.test_applicant_id IS NOT NULL THEN
    SELECT academy_id INTO applicant_academy_id FROM paca.test_applicants WHERE id = NEW.test_applicant_id;
  END IF;

  IF session_academy_id IS NOT NULL AND NEW.academy_id <> session_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_records session academy scope violation';
  END IF;
  IF student_academy_id IS NOT NULL AND NEW.academy_id <> student_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_records student academy scope violation';
  END IF;
  IF applicant_academy_id IS NOT NULL AND NEW.academy_id <> applicant_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_records applicant academy scope violation';
  END IF;
END//

CREATE TRIGGER before_test_records_update_academy_guard
BEFORE UPDATE ON test_records
FOR EACH ROW
BEGIN
  DECLARE session_academy_id INT;
  DECLARE student_academy_id INT;
  DECLARE applicant_academy_id INT;

  SELECT mt.academy_id INTO session_academy_id
  FROM test_sessions ts
  JOIN monthly_tests mt ON mt.id = ts.monthly_test_id
  WHERE ts.id = NEW.test_session_id;

  IF NEW.student_id IS NOT NULL THEN
    SELECT academy_id INTO student_academy_id FROM students WHERE id = NEW.student_id;
  END IF;

  IF NEW.test_applicant_id IS NOT NULL THEN
    SELECT academy_id INTO applicant_academy_id FROM paca.test_applicants WHERE id = NEW.test_applicant_id;
  END IF;

  IF session_academy_id IS NOT NULL AND NEW.academy_id <> session_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_records session academy scope violation';
  END IF;
  IF student_academy_id IS NOT NULL AND NEW.academy_id <> student_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_records student academy scope violation';
  END IF;
  IF applicant_academy_id IS NOT NULL AND NEW.academy_id <> applicant_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test_records applicant academy scope violation';
  END IF;
END//

CREATE TRIGGER before_push_subscriptions_insert_academy_guard
BEFORE INSERT ON push_subscriptions
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.users
  WHERE id = NEW.user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'push_subscriptions academy scope violation';
  END IF;
END//

CREATE TRIGGER before_push_subscriptions_update_academy_guard
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.users
  WHERE id = NEW.user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'push_subscriptions academy scope violation';
  END IF;
END//

CREATE TRIGGER before_notifications_insert_academy_guard
BEFORE INSERT ON notifications
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.users
  WHERE id = NEW.user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'notifications academy scope violation';
  END IF;
END//

CREATE TRIGGER before_notifications_update_academy_guard
BEFORE UPDATE ON notifications
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.users
  WHERE id = NEW.user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'notifications academy scope violation';
  END IF;
END//

CREATE TRIGGER before_trainers_insert_academy_guard
BEFORE INSERT ON trainers
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id INTO expected_academy_id
  FROM paca.users
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
  FROM paca.users
  WHERE id = NEW.paca_user_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'trainers academy scope violation';
  END IF;
END//

DELIMITER ;
