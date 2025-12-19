'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 로그인 체크 후 리다이렉트
    if (authAPI.isAuthenticated()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  // 로딩 화면
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-4">P-EAK</h1>
        <p className="text-emerald-100">로딩 중...</p>
      </div>
    </div>
  );
}
