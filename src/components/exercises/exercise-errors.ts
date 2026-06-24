export function getExerciseErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;

  const maybeError = error as {
    response?: { status?: number };
    code?: string;
  };

  if (maybeError.code === 'ERR_NETWORK') {
    return '서버와 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
  if (maybeError.response?.status === 401) {
    return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  }
  if (maybeError.response?.status === 403) {
    return '운동 설정을 변경할 권한이 없습니다.';
  }
  if (maybeError.response?.status === 404) {
    return '운동 정보를 찾지 못했습니다. 새로고침 후 다시 시도해주세요.';
  }
  if (maybeError.response?.status && maybeError.response.status >= 500) {
    return '운동 정보를 저장하는 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.';
  }

  return fallback;
}
