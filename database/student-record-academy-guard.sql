DELIMITER //

CREATE TRIGGER before_student_records_insert_academy_guard
BEFORE INSERT ON student_records
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id
  INTO expected_academy_id
  FROM students
  WHERE id = NEW.student_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'student_records academy scope violation';
  END IF;
END//

CREATE TRIGGER before_student_records_update_academy_guard
BEFORE UPDATE ON student_records
FOR EACH ROW
BEGIN
  DECLARE expected_academy_id INT;

  SELECT academy_id
  INTO expected_academy_id
  FROM students
  WHERE id = NEW.student_id;

  IF expected_academy_id IS NOT NULL AND NEW.academy_id <> expected_academy_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'student_records academy scope violation';
  END IF;
END//

DELIMITER ;
