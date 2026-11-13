-- 반 배치를 P-ACA 지점별로 나누기 (2026-11)
-- 조(class_num)가 어느 P-ACA 지점 것인지, 어느 P-ACA 반에서 자동으로 만든 조인지 적는다.
-- NULL = 지점 없음(지점을 안 쓰는 학원은 전부 NULL). class_num 은 지금처럼 학원·날짜·시간대 안에서 하나뿐이다.
-- 코드 배포 전에 먼저 적용한다. P-ACA 지점·반 배포(branches, students.branch_id)가 먼저다.
ALTER TABLE class_instructors
    ADD COLUMN branch_id INT NULL COMMENT 'P-ACA branches.id. NULL = 지점 없음',
    ADD COLUMN paca_class_id INT NULL COMMENT '동기화가 이 P-ACA 반(classes.id)으로 만든 조';
