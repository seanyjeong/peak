import { getExerciseErrorMessage } from '@/components/exercises/exercise-errors';

describe('운동 오류 안내', () => {
  it('사용 중이라 지우지 못한 운동은 서버 안내를 그대로 보인다 (QA Q02)', () => {
    const error = {
      response: {
        status: 409,
        data: { error: 'exercise_in_use', message: '수업 계획에서 사용 중입니다. 계획에서 운동을 먼저 제외해 주세요.' },
      },
    };

    expect(getExerciseErrorMessage(error, '운동을 삭제하지 못했습니다.'))
      .toBe('수업 계획에서 사용 중입니다. 계획에서 운동을 먼저 제외해 주세요.');
  });

  it('서버 안내가 없으면 화면 기본 문구를 보인다', () => {
    const error = { response: { status: 409, data: { error: 'before_snapshot_changed' } } };

    expect(getExerciseErrorMessage(error, '운동을 삭제하지 못했습니다.')).toBe('운동을 삭제하지 못했습니다.');
  });
});
