import { ShieldCheck } from 'lucide-react';

export function SettingsAccessDenied() {
  return (
    <main className="max-w-[720px] px-6 py-10 lg:px-8">
      <section className="rounded-2xl bg-card p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <h1 className="mt-4 text-lg font-bold text-foreground">설정을 열 수 없습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">실기 측정 설정 권한이 없습니다. 원장에게 권한을 요청해주세요.</p>
      </section>
    </main>
  );
}
