import MonthlyTestRankingsPage from '@/app/(pc)/monthly-test/[testId]/rankings/page';

export default function TabletMonthlyTestRankingsPage({ params }: { params: Promise<{ testId: string }> }) {
  return <MonthlyTestRankingsPage params={params} />;
}
