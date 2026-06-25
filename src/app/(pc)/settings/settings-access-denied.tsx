import { ShieldCheck } from 'lucide-react';

export function SettingsAccessDenied() {
  return (
    <main className="max-w-[720px] px-6 py-10 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
        <h1 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">설정을 열 수 없습니다</h1>
        <p className="mt-2 text-sm text-slate-500">실기 측정 설정 권한이 없습니다. 원장에게 권한을 요청해주세요.</p>
      </section>
    </main>
  );
}
