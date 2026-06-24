import StudentProfilePage from '@/app/(pc)/students/[id]/page';

export default function TabletStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return <StudentProfilePage params={params} />;
}
