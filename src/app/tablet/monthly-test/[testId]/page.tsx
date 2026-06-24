import MonthlyTestDetailPage from '@/app/(pc)/monthly-test/[testId]/page';

export default function TabletMonthlyTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  return <MonthlyTestDetailPage params={params} />;
}
