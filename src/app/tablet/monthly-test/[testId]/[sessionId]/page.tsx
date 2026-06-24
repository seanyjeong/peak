import MonthlyTestSessionPage from '@/app/(pc)/monthly-test/[testId]/[sessionId]/page';

export default function TabletMonthlyTestSessionPage({ params }: { params: Promise<{ testId: string; sessionId: string }> }) {
  return <MonthlyTestSessionPage params={params} />;
}
