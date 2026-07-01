describe('Peak auth middleware legacy API key removal', () => {
  const originalEnv = { ...process.env };
  let queryMock;

  function loadAuth(env = {}) {
    jest.resetModules();
    queryMock = jest.fn();
    jest.doMock('mysql2/promise', () => ({
      createPool: jest.fn(() => ({ query: queryMock })),
    }));
    jest.doMock('jsonwebtoken', () => ({
      verify: jest.fn(() => ({ userId: 12 })),
      sign: jest.fn(() => 'token'),
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('../../../backend/utils/encryption', () => ({
      decrypt: jest.fn((value) => value.replace('ENC:', '')),
    }));
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret',
      PACA_DB_PASSWORD: 'test-password',
      ...env,
    };
    return require('../../../backend/middleware/auth');
  }

  function mockResponse() {
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
    };
    return res;
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('legacy N8N_API_KEY header is not accepted', async () => {
    const { verifyToken } = loadAuth({ N8N_API_KEY: 'legacy-key' });
    const req = { headers: { 'x-api-key': 'legacy-key' } };
    const res = mockResponse();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'No token provided',
    });
  });

  test('valid JWT still loads the academy-scoped PACA user', async () => {
    const { verifyToken } = loadAuth();
    queryMock.mockResolvedValueOnce([
      [{
        id: 12,
        email: 'coach@example.com',
        name: 'ENC:Coach',
        role: 'admin',
        academy_id: 3,
        is_active: 1,
        approval_status: 'approved',
        position: 'coach',
        instructor_id: 9,
      }],
    ]);
    const req = { headers: { authorization: 'Bearer jwt-token' } };
    const res = mockResponse();
    const next = jest.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({
      id: 12,
      name: 'Coach',
      role: 'admin',
      academyId: 3,
      instructorId: 9,
    });
  });
});
