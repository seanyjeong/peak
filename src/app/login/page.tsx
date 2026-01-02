'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);

  // P-ACA에서 토큰으로 자동 로그인
  useEffect(() => {
    // URL에서 token 파라미터 추출
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      setAutoLoginLoading(true);
      // 토큰 저장 후 검증
      localStorage.setItem('peak_token', token);
      authAPI.verifyToken()
        .then((user) => {
          if (user) {
            localStorage.setItem('peak_user', JSON.stringify(user));
            // URL에서 token 파라미터 제거 후 이동
            window.location.href = '/dashboard';
          } else {
            // 토큰 검증 실패 시 제거
            localStorage.removeItem('peak_token');
            setAutoLoginLoading(false);
          }
        })
        .catch(() => {
          localStorage.removeItem('peak_token');
          setAutoLoginLoading(false);
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.login(email, password);
      if (result.success) {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 자동 로그인 중 로딩 화면
  if (autoLoginLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 p-4">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">P-EAK</h1>
          <div className="flex items-center justify-center gap-2 text-white">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>P-ACA에서 로그인 중...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">P-EAK</h1>
          <p className="text-emerald-100 text-lg">피크 - 기록의 정점을 향해</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            로그인
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="P-ACA 계정 이메일"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="비밀번호"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            P-ACA 계정으로 로그인하세요
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-emerald-100 text-sm mt-6">
          Physical Excellence Achievement Keeper
        </p>
      </div>
    </div>
  );
}
