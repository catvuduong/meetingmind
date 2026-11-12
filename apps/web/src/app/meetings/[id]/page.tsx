import { Suspense } from 'react';
import { MeetingDetail } from '@/components/meeting-detail';
import { ResultSkeleton } from '@/components/states';

export default function MeetingPage() {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <MeetingDetail />
    </Suspense>
  );
}
