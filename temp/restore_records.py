#!/usr/bin/env python3
"""
test.csv에서 일산 계정(academy_id=2) 기록 복구
"""
import csv
import mysql.connector
from datetime import datetime

# DB 연결
db = mysql.connector.connect(
    host='localhost',
    user='paca',
    password='q141171616!',
    database='peak'
)
cursor = db.cursor(dictionary=True)

# Record type 매핑 (CSV 컬럼 → record_type_id)
RECORD_MAP = {
    'jump_cm': 1,        # 제자리멀리뛰기
    'medball_m': 2,      # 메디신볼
    'run20m_sec': 3,     # 20m왕복달리기
    'sit_reach_cm': 4,   # 좌전굴
    'run10m_sec': 5,     # 10m왕복달리기
    'situp_count': 6,    # 윗몸일으키기
    'back_strength': 7,  # 배근력
}

# Gender 매핑
GENDER_MAP = {'여': 'F', '남': 'M'}

# 1. 기존 academy_id=2 기록 삭제
print("기존 기록 삭제 중...")
cursor.execute("DELETE FROM student_records WHERE academy_id = 2")
deleted = cursor.rowcount
print(f"  삭제: {deleted}개")

# 2. P-EAK 학생 목록 로드
cursor.execute("SELECT id, name, gender FROM students WHERE academy_id = 2")
students = {(s['name'], s['gender']): s['id'] for s in cursor.fetchall()}
print(f"P-EAK 학생 {len(students)}명 로드")

# 3. CSV 읽기 및 INSERT
inserted = 0
skipped = 0
not_found = set()

with open('/home/sean/ilsanmaxtraining/test.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)

    for row in reader:
        name = row['name']
        gender = GENDER_MAP.get(row['gender'], row['gender'])

        # 학생 찾기
        student_id = students.get((name, gender))
        if not student_id:
            not_found.add((name, gender))
            skipped += 1
            continue

        # created_at 기준으로 날짜 설정
        created_at = row.get('created_at', '')
        if created_at:
            measured_at = created_at.split(' ')[0]
        else:
            measured_at = datetime.now().strftime('%Y-%m-%d')

        # 각 종목별 기록 INSERT
        for col, record_type_id in RECORD_MAP.items():
            value = row.get(col, '')
            if value and value != 'NULL' and value.strip():
                try:
                    value = float(value)
                    cursor.execute("""
                        INSERT INTO student_records
                        (academy_id, student_id, record_type_id, value, measured_at)
                        VALUES (2, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE value = VALUES(value)
                    """, (student_id, record_type_id, value, measured_at))
                    inserted += 1
                except Exception as e:
                    print(f"  에러: {name} {col}={value}: {e}")

db.commit()

print(f"\n=== 결과 ===")
print(f"INSERT: {inserted}개")
print(f"SKIP (학생 없음): {skipped}개")
if not_found:
    print(f"\n찾지 못한 학생:")
    for name, gender in sorted(not_found):
        print(f"  - {name} ({gender})")

cursor.close()
db.close()
