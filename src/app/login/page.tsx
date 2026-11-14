'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { authAPI } from '@/lib/api/auth';
import { getLoginErrorMessage } from './login-messages';

const fieldClassName =
  'h-12 w-full rounded-lg border border-border bg-card px-11 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground focus:ring-4 focus:ring-border';

function AutoLoginView() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 text-foreground">
      <section className="w-full max-w-sm rounded-2xl bg-card p-7 text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-lg bg-foreground text-background">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-normal">P-EAK</h1>
        <p className="mt-2 text-sm text-muted-foreground">자동 로그인을 확인하고 있습니다.</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const token = urlParams.get('token');

    if (code) {
      setAutoLoginLoading(true);
      authAPI.exchangeSsoCode(code)
        .then((result) => {
          if (result.success) {
            window.location.href = '/dashboard';
            return;
          }
          setAutoLoginLoading(false);
          setError('자동 로그인을 완료하지 못했습니다. P-ACA에서 다시 열어주세요.');
        })
        .catch(() => {
          setAutoLoginLoading(false);
          setError('자동 로그인을 완료하지 못했습니다. P-ACA에서 다시 열어주세요.');
        });
      return;
    }

    if (token) {
      setAutoLoginLoading(true);
      localStorage.setItem('peak_token', token);
      authAPI.verifyToken()
        .then((user) => {
          if (user) {
            localStorage.setItem('peak_user', JSON.stringify(user));
            window.location.href = '/dashboard';
            return;
          }
          localStorage.removeItem('peak_token');
          setAutoLoginLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('peak_token');
          setAutoLoginLoading(false);
        });
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.login(email, password);
      if (result.success) {
        router.push('/dashboard');
      }
    } catch (loginError: unknown) {
      setError(getLoginErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  if (autoLoginLoading) {
    return <AutoLoginView />;
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm font-semibold text-secondary-foreground">
            <Activity className="size-4 text-success" aria-hidden="true" />
            PEAK OPERATIONS
          </div>
          <h1 className="mt-6 text-6xl font-black tracking-normal text-foreground">P-EAK</h1>
          <p className="mt-4 max-w-lg text-lg leading-8 text-secondary-foreground">
            실기 기록과 수업 운영을 관리하는 피크 관리자 화면입니다.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {['출석', '반 배치', '기록'].map((label) => (
              <div key={label} className="rounded-2xl bg-card p-4">
                <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                <div className="mt-4 h-1.5 rounded-full bg-muted">
                  <div className="h-full w-2/3 rounded-full bg-success" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-2xl bg-card p-6 sm:p-8">
          <div className="mb-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-normal text-success">P-EAK</p>
                <h2 className="mt-2 text-3xl font-black tracking-normal">로그인</h2>
              </div>
              <div className="flex size-12 items-center justify-center rounded-lg bg-foreground text-background">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">P-ACA 계정으로 접속합니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-secondary-foreground">이메일</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClassName}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-secondary-foreground">비밀번호</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClassName}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  required
                />
              </span>
            </label>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm font-medium leading-6 text-destructive"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-[15px] font-bold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  확인 중
                </>
              ) : (
                <>
                  로그인
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
