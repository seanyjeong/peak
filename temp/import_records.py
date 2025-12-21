#!/usr/bin/env python3
import csv
import subprocess

# 학생 목록 가져오기
result = subprocess.run(
    ['mysql', '-u', 'paca', '-pq141171616!', 'peak', '-N', '-e', 'SELECT id, name FROM students'],
    capture_output=True, text=True
)

students = {}
for line in result.stdout.strip().split('\n'):
    if line:
        parts = line.split('\t')
        if len(parts) == 2:
            students[parts[1]] = parts[0]

print(f"DB 학생 수: {len(students)}")

# 제외할 이름 (동명이인)
exclude_names = {'박시현'}

# 종목 매핑
record_type_map = {
    'jump_cm': 1,       # 제자리멀리뛰기
    'medball_m': 2,     # 메디신볼
    'run20m_sec': 3,    # 20m왕복달리기
    'run10m_sec': 5,    # 10m왕복달리기
    'situp_count': 6,   # 윗몸일으키기
    'sit_reach_cm': 4,  # 좌전굴
    'back_strength': 7, # 배근력
}

# SQL 생성
sql_statements = []
skipped_names = set()
matched_names = set()

with open('/home/sean/ilsanmaxtraining/temp/test.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)

    for row in reader:
        name = row['name']
        created_at = row.get('created_at', '').strip()

        if name in exclude_names:
            continue

        if name not in students:
            skipped_names.add(name)
            continue

        # created_at에서 날짜 추출 (예: "2025-05-04 23:47:00" → "2025-05-04")
        if not created_at or len(created_at) < 10:
            continue
        measured_at = created_at[:10]

        student_id = students[name]
        matched_names.add(name)

        for col, record_type_id in record_type_map.items():
            value = row.get(col, '').strip()

            if not value or value == 'NULL' or value == 'F':
                continue

            try:
                value_float = float(value)
                sql_statements.append(
                    f"INSERT INTO student_records (student_id, record_type_id, value, measured_at) "
                    f"VALUES ({student_id}, {record_type_id}, {value_float}, '{measured_at}');"
                )
            except ValueError:
                print(f"잘못된 값: {name} - {col} = {value}")

# SQL 파일 저장
with open('/home/sean/ilsanmaxtraining/temp/import.sql', 'w') as f:
    f.write('\n'.join(sql_statements))

print(f"\n=== SQL 생성 완료 ===")
print(f"총 INSERT 문: {len(sql_statements)}건")
print(f"매칭된 학생: {len(matched_names)}명")
print(f"매칭된 이름: {sorted(matched_names)}")
print(f"\n스킵된 학생: {len(skipped_names)}명")
print(f"스킵된 이름: {sorted(skipped_names)}")
print(f"\n실행 명령어:")
print(f"mysql -u paca -pq141171616! peak < /home/sean/ilsanmaxtraining/temp/import.sql")
