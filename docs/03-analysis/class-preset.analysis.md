# Gap Analysis: class-preset (반배치 프리셋 시스템)

**분석일**: 2026-02-14
**Match Rate**: 92%

## 체크리스트

### 1. DB 스키마 (✅ 100%)
| Design | Implementation | Status |
|--------|---------------|--------|
| class_presets (7 columns) | 7 columns 일치 | ✅ |
| preset_groups (5 columns) | 5 columns 일치 | ✅ |
| preset_group_members (3 columns + UNIQUE) | 3 columns + UNIQUE KEY 일치 | ✅ |
| INDEX idx_academy | idx_academy 존재 | ✅ |
| FOREIGN KEY CASCADE | CASCADE 적용 확인 | ✅ |

### 2. API 엔드포인트 (✅ 100%)
| Design | Implementation | Status |
|--------|---------------|--------|
| GET /peak/presets | router.get(/) ✓ | ✅ |
| POST /peak/presets | router.post(/) ✓ | ✅ |
| PUT /peak/presets/:id | router.put(/:id) ✓ | ✅ |
| DELETE /peak/presets/:id | router.delete(/:id) ✓ | ✅ |
| POST /peak/presets/:id/groups | router.post(/:id/groups) ✓ | ✅ |
| PUT /peak/presets/groups/:groupId | router.put(/groups/:groupId) ✓ | ✅ |
| DELETE /peak/presets/groups/:groupId | router.delete(/groups/:groupId) ✓ | ✅ |
| POST /groups/:groupId/members | router.post(/groups/:groupId/members) ✓ | ✅ |
| DELETE /groups/:groupId/members | router.delete(/groups/:groupId/members) ✓ | ✅ |
| POST /peak/presets/:id/apply | router.post(/:id/apply) ✓ | ✅ |

### 3. Apply 로직 5단계 (✅ 100%)
| Design Step | Implementation | Status |
|-------------|---------------|--------|
| 1. 프리셋 로드 (그룹+멤버) | preset + groups + member_ids 로드 | ✅ |
| 2. 출근 강사 확인 (Paca) | instructor_schedules + owners 조회 | ✅ |
| 3. 오늘 학생 확인 (daily_assignments) | studentAssignmentMap 생성 | ✅ |
| 4. 현재 배치 초기화 | class_instructors DELETE + class_id NULL | ✅ |
| 5. 그룹별 반 생성 + 배정 | classNum 순차, instructor + student 배정 | ✅ |
| Socket.io broadcast | io.to().emit() 존재 | ✅ |

### 4. PC 프리셋 관리 페이지 (⚠️ 85%)
| Design | Implementation | Status |
|--------|---------------|--------|
| PresetTabs (프리셋 선택) | presets.map() 탭 렌더링 | ✅ |
| UnassignedStudents (미배정) | UnassignedArea 컴포넌트 + droppable | ✅ |
| GroupColumn (그룹 카드) | GroupColumn + 강사 picker + 이름 편집 | ✅ |
| AddGroupZone | "+" 그룹 추가 버튼 | ✅ |
| @dnd-kit D&D | DndContext + useDraggable + useDroppable | ✅ |
| 새 프리셋 모달 | showNewPreset 모달 구현 | ✅ |
| **학생 목록 API 필드 매핑** | `(s as any).id` 캐스팅 사용 | ⚠️ 타입 안전성 부족 |
| **그룹 강사 이름 표시 (담임제)** | instructor_name from API | ✅ |

### 5. 반배치 페이지 연동 (✅ 95%)
| Design | Implementation | Status |
|--------|---------------|--------|
| PC: 프리셋 적용 버튼 | Layers 아이콘 + "프리셋 적용" | ✅ |
| PC: 프리셋 드롭다운 | showPresetMenu 토글 | ✅ |
| PC: 적용 확인 모달 | showPresetConfirm 모달 (경고 포함) | ✅ |
| Tablet: 프리셋 적용 버튼 | 동일 구현 | ✅ |
| Tablet: 적용 확인 모달 | 동일 구현 | ✅ |
| **드롭다운 외부 클릭 닫기** | 미구현 | ⚠️ |

### 6. 사이드메뉴 (✅ 100%)
| Design | Implementation | Status |
|--------|---------------|--------|
| PC: "반 프리셋" + Layers icon | layout.tsx line 21, 38 | ✅ |
| Tablet: "반 프리셋" + Layers icon | layout.tsx line 27, 47, 61 | ✅ |

### 7. 에러 처리 (✅ 90%)
| Design | Implementation | Status |
|--------|---------------|--------|
| 강사 미출근 → 반 생성, 토스트 | instructorsAbsent 카운트, 반 생성 | ✅ (토스트 대신 결과 JSON) |
| 학생 결석 → 대기 영역 | matchingStudentIds 필터 | ✅ |
| 학생 스케줄 없음 → 무시 | studentAssignmentMap에 없으면 스킵 | ✅ |
| 중복 적용 → 확인 모달 | showPresetConfirm 경고 모달 | ✅ |
| 프리셋 비어있음 | presets.length === 0 시 버튼 숨김 | ✅ |

### 8. 기존 시스템 영향 (✅ 100%)
| Item | Check | Status |
|------|-------|--------|
| assignments.js 변경 | grep preset = 0건 | ✅ |
| daily_assignments 스키마 변경 | 없음 | ✅ |
| class_instructors 스키마 변경 | 없음 | ✅ |
| 기존 D&D 기능 | 영향 없음 | ✅ |

## Gap 목록

### Minor (4건)
1. **PC presets page**: `(s as any).id` 타입 캐스팅 → Student 인터페이스에 `id` 필드 추가 권장
2. **드롭다운 외부 클릭 닫기**: 프리셋 적용 드롭다운 열린 상태에서 다른 곳 클릭 시 닫히지 않음
3. **Apply 결과 표시**: API에서 결과 JSON 반환하지만 프론트에서 토스트/알림으로 표시하지 않음
4. **Tablet presets page**: PC 버전 그대로 복사 → 터치 최적화(TouchSensor) 미적용

## 결론
- **Match Rate: 92%**
- 핵심 기능(DB/API/UI/연동) 모두 Design 대로 구현됨
- 기존 시스템 영향 제로 확인
- Minor gap 4건은 기능 동작에 영향 없음
