type LoginErrorLike = {
  code?: string;
  message?: string;
  response?: {
    status?: number;
  };
};

function asLoginError(error: unknown): LoginErrorLike {
  if (error && typeof error === 'object') {
    return error as LoginErrorLike;
  }
  return {};
}

export function getLoginErrorMessage(error: unknown): string {
  const loginError = asLoginError(error);
  const status = loginError.response?.status;

  if (status === 400 || status === 401) {
    return '이메일과 비밀번호를 다시 확인해주세요.';
  }

  if (status === 403) {
    return '계정 상태를 확인해주세요. 학원 관리자에게 문의해주세요.';
  }

  if (status === 429) {
    return '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.';
  }

  if (!loginError.response) {
    if (loginError.code === 'ECONNABORTED') {
      return '응답 시간이 길어지고 있습니다. 잠시 후 다시 시도해주세요.';
    }
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.';
  }

  return '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.';
}
