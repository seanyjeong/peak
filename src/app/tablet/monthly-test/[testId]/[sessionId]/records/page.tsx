import MonthlyTestSessionRecordsPage from '@/app/(pc)/monthly-test/[testId]/[sessionId]/records/page';

export default function TabletMonthlyTestSessionRecordsPage({ params }: { params: Promise<{ testId: string; sessionId: string }> }) {
  return <MonthlyTestSessionRecordsPage params={params} />;
}
