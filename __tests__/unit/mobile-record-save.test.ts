import { saveMobileRecord } from '@/app/mobile/records/record-save';

const recordTypes = [{
  id: 3,
  name: '20m왕복달리기',
  unit: '초',
  min_value: 1,
  max_value: 30,
}];

function mockFetchOk(body: unknown = { success: true, results: [{ action: 'saved' }] }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(body),
  }) as jest.Mock;
}

describe('saveMobileRecord', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('posts the records batch contract with a strict numeric value', async () => {
    mockFetchOk();

    const result = await saveMobileRecord({
      apiBase: 'https://supermax.kr/peak',
      token: 'token',
      studentId: 9640,
      recordTypeId: 3,
      selectedDate: '2026-06-17',
      value: '12.5',
      recordTypes,
    });

    expect(result).toEqual({ deleted: false, value: 12.5 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://supermax.kr/peak/records/batch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          student_id: 9640,
          measured_at: '2026-06-17',
          records: [{ record_type_id: 3, value: 12.5 }],
        }),
      })
    );
  });

  it('deletes the record when the value is blank or zero', async () => {
    mockFetchOk({ success: true });

    await expect(saveMobileRecord({
      apiBase: 'https://supermax.kr/peak',
      token: 'token',
      studentId: 9640,
      recordTypeId: 3,
      selectedDate: '2026-06-17',
      value: '0',
      recordTypes,
    })).resolves.toEqual({ deleted: true, value: null });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://supermax.kr/peak/records',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          student_id: 9640,
          record_type_id: 3,
          measured_at: '2026-06-17',
        }),
      })
    );
  });

  it('blocks non numeric values before calling the API', async () => {
    global.fetch = jest.fn() as jest.Mock;

    await expect(saveMobileRecord({
      apiBase: 'https://supermax.kr/peak',
      token: 'token',
      studentId: 9640,
      recordTypeId: 3,
      selectedDate: '2026-06-17',
      value: '12초',
      recordTypes,
    })).rejects.toThrow('기록은 숫자로 입력해주세요.');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks values outside the configured record type range', async () => {
    global.fetch = jest.fn() as jest.Mock;

    await expect(saveMobileRecord({
      apiBase: 'https://supermax.kr/peak',
      token: 'token',
      studentId: 9640,
      recordTypeId: 3,
      selectedDate: '2026-06-17',
      value: '250',
      recordTypes,
    })).rejects.toThrow('20m왕복달리기 기록은 1~30초 사이로 입력해주세요.');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows Korean API messages on save failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        message: '20m왕복달리기 기록은 1~30초 사이로 입력해주세요.',
      }),
    }) as jest.Mock;

    await expect(saveMobileRecord({
      apiBase: 'https://supermax.kr/peak',
      token: 'token',
      studentId: 9640,
      recordTypeId: 3,
      selectedDate: '2026-06-17',
      value: '12',
      recordTypes,
    })).rejects.toThrow('20m왕복달리기 기록은 1~30초 사이로 입력해주세요.');
  });
});
