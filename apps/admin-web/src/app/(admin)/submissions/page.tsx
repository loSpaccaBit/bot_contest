import { Suspense } from 'react';
import { SubmissionsContent } from '@/components/submissions/submissions-content';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner /></div>}>
      <SubmissionsContent />
    </Suspense>
  );
}
