import { getLoginErrorMessage } from '@/app/login/login-messages';

describe('login error messages', () => {
  it('uses a plain credential message for rejected login attempts', () => {
    const message = getLoginErrorMessage({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    expect(message).toBe('이메일과 비밀번호를 다시 확인해주세요.');
    expect(message).not.toMatch(/Unauthorized|401|token|CORS|Network Error/i);
  });

  it('uses a plain account status message for forbidden accounts', () => {
    const message = getLoginErrorMessage({
      response: { status: 403, data: { message: 'Forbidden' } },
    });

    expect(message).toBe('계정 상태를 확인해주세요. 학원 관리자에게 문의해주세요.');
    expect(message).not.toMatch(/Forbidden|403|stack/i);
  });

  it('uses a plain network message when the browser cannot reach the server', () => {
    const message = getLoginErrorMessage({ message: 'Network Error' });

    expect(message).toBe('서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.');
    expect(message).not.toMatch(/Network Error|CORS|ERR_/i);
  });
});
