/**
 * 에러 메시지 상수
 * 사용자에게 표시되는 에러 메시지 통합 관리
 */

// 네트워크 에러
export const NETWORK_ERRORS = {
  CONNECTION_FAILED: '네트워크 연결을 확인해주세요',
  TIMEOUT: '요청 시간이 초과되었습니다. 다시 시도해주세요',
  OFFLINE: '인터넷에 연결되어 있지 않습니다',
} as const;

// 인증 에러
export const AUTH_ERRORS = {
  UNAUTHORIZED: '로그인이 필요합니다',
  SESSION_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다',
  ACCESS_DENIED: '접근 권한이 없습니다',
} as const;

// 데이터 에러
export const DATA_ERRORS = {
  NOT_FOUND: '요청한 데이터를 찾을 수 없습니다',
  LOAD_FAILED: '데이터를 불러오는 중 오류가 발생했습니다',
  SAVE_FAILED: '저장 중 오류가 발생했습니다',
  DELETE_FAILED: '삭제 중 오류가 발생했습니다',
  UPDATE_FAILED: '수정 중 오류가 발생했습니다',
  DUPLICATE: '중복된 데이터가 존재합니다',
} as const;

// 유효성 검사 에러
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: '필수 항목을 입력해주세요',
  INVALID_FORMAT: '올바른 형식으로 입력해주세요',
  INVALID_DATE: '유효한 날짜를 입력해주세요',
  INVALID_NUMBER: '유효한 숫자를 입력해주세요',
  VALUE_TOO_LONG: '입력 가능한 길이를 초과했습니다',
  VALUE_TOO_SHORT: '최소 길이 이상 입력해주세요',
} as const;

// 서버 에러
export const SERVER_ERRORS = {
  INTERNAL_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
  SERVICE_UNAVAILABLE: '서비스를 이용할 수 없습니다. 잠시 후 다시 시도해주세요',
  MAINTENANCE: '서비스 점검 중입니다',
} as const;

// 동작 에러
export const ACTION_ERRORS = {
  SYNC_FAILED: '동기화에 실패했습니다',
  EXPORT_FAILED: '내보내기에 실패했습니다',
  IMPORT_FAILED: '가져오기에 실패했습니다',
} as const;

// 성공 메시지
export const SUCCESS_MESSAGES = {
  SAVED: '저장되었습니다',
  DELETED: '삭제되었습니다',
  UPDATED: '수정되었습니다',
  CREATED: '등록되었습니다',
  SYNCED: '동기화되었습니다',
  EXPORTED: '내보내기 완료',
  IMPORTED: '가져오기 완료',
} as const;

// HTTP 상태 코드별 에러 메시지 매핑
export const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: VALIDATION_ERRORS.INVALID_FORMAT,
  401: AUTH_ERRORS.UNAUTHORIZED,
  403: AUTH_ERRORS.ACCESS_DENIED,
  404: DATA_ERRORS.NOT_FOUND,
  408: NETWORK_ERRORS.TIMEOUT,
  409: DATA_ERRORS.DUPLICATE,
  422: VALIDATION_ERRORS.INVALID_FORMAT,
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
  500: SERVER_ERRORS.INTERNAL_ERROR,
  502: SERVER_ERRORS.SERVICE_UNAVAILABLE,
  503: SERVER_ERRORS.SERVICE_UNAVAILABLE,
  504: NETWORK_ERRORS.TIMEOUT,
};

// 기본 에러 메시지
export const DEFAULT_ERROR_MESSAGE = '오류가 발생했습니다. 다시 시도해주세요';

/**
 * HTTP 상태 코드에 해당하는 에러 메시지 반환
 */
export function getErrorMessageByStatus(status: number): string {
  return HTTP_ERROR_MESSAGES[status] || DEFAULT_ERROR_MESSAGE;
}
