/* eslint-disable @typescript-eslint/no-require-imports */

function loadEnvConfig() {
  jest.resetModules();
  return require('../../../backend/config/env');
}

describe('backend environment configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PEAK_CORS_ORIGINS;
    delete process.env.CORS_ORIGINS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows the production, Vercel, and development browser origins', () => {
    process.env.NODE_ENV = 'production';
    const { isOriginAllowed } = loadEnvConfig();

    expect(isOriginAllowed('https://chejump.com')).toBe(true);
    expect(isOriginAllowed('https://supermax.kr')).toBe(true);
    expect(isOriginAllowed('https://peak-rose.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://dev.sean8320.dedyn.io')).toBe(true);
  });

  it('allows non-browser requests and rejects unknown browser origins', () => {
    process.env.NODE_ENV = 'production';
    const { isOriginAllowed } = loadEnvConfig();

    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed('https://unknown.example.com')).toBe(false);
  });

  it('adds configured origins without removing the defaults', () => {
    process.env.NODE_ENV = 'production';
    process.env.PEAK_CORS_ORIGINS = 'https://preview.example.com';
    const { getCorsOrigins, isOriginAllowed } = loadEnvConfig();

    expect(getCorsOrigins()).toContain('https://chejump.com');
    expect(isOriginAllowed('https://preview.example.com')).toBe(true);
  });

  it('fails fast for missing production secrets', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DB_PASSWORD;
    const { requireEnv } = loadEnvConfig();

    expect(() => requireEnv('DB_PASSWORD')).toThrow('Missing required environment variable');
  });

  it('keeps tests isolated from local secret files', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DB_PASSWORD;
    const { requireEnv } = loadEnvConfig();

    expect(requireEnv('DB_PASSWORD')).toBe('test-db_password');
  });
});
