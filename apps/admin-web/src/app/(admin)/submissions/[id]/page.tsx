import { SubmissionDetailContent } from '@/components/submissions/submission-detail-content';

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SubmissionDetailContent id={id} />;
}
