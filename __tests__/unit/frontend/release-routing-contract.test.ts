import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');

function source(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

describe('Peak release routing contract', () => {
  const forbiddenLegacyOrigins = [
    'chejump.com',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_FALLBACK_API_URL',
    'NEXT_PUBLIC_SOCKET_URL',
  ];

  const forbiddenLocalBackends = [
    'http://localhost:8330',
    'ws://localhost:8330',
    'http://127.0.0.1:8330',
    'ws://127.0.0.1:8330',
  ];

  it('keeps production CSP on supermax only', () => {
    const nextConfig = source('next.config.js');

    expect(nextConfig).toContain('https://supermax.kr');
    expect(nextConfig).toContain('wss://supermax.kr');
    for (const forbidden of forbiddenLocalBackends) {
      expect(nextConfig).not.toContain(forbidden);
    }
    for (const forbidden of forbiddenLegacyOrigins) {
      expect(nextConfig).not.toContain(forbidden);
    }
  });

  it('uses the canonical socket URL for browser clients', () => {
    const useSocket = source('src/hooks/useSocket.ts');

    expect(useSocket).toContain('PEAK_SOCKET_URL');
    expect(useSocket).toContain('SOCKET_URL = PEAK_SOCKET_URL');
    for (const forbidden of forbiddenLocalBackends) {
      expect(useSocket).not.toContain(forbidden);
    }
  });

  it('keeps browser API base on supermax and disables same-origin fallback retries', () => {
    const baseUrl = source('src/lib/api/base-url.ts');
    const apiClient = source('src/lib/api/client.ts');

    expect(baseUrl).toContain("PEAK_API_BASE_URL = 'https://supermax.kr/peak'");
    expect(baseUrl).toContain('PEAK_FALLBACK_API_BASE_URL = PEAK_API_BASE_URL');
    expect(apiClient).toContain('function hasFallback(): boolean');
    expect(apiClient).toContain('return FALLBACK_URL !== PRIMARY_URL');
    expect(apiClient).toContain('hasFallback() && !usingFallback && isNetworkError');
    for (const forbidden of forbiddenLegacyOrigins) {
      expect(baseUrl).not.toContain(forbidden);
      expect(apiClient).not.toContain(forbidden);
    }
  });
});
