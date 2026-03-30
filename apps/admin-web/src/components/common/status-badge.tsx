import { Badge } from '@/components/ui/badge';
import { SubmissionStatus } from '@domusbet/shared-types';
import { cn } from '@/lib/utils';

const statusConfig: Record<SubmissionStatus, { label: string; className: string }> = {
  [SubmissionStatus.PENDING]: {
    label: 'In Attesa',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  },
  [SubmissionStatus.APPROVED]: {
    label: 'Approvata',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  [SubmissionStatus.REJECTED]: {
    label: 'Rifiutata',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
};

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

export function SubmissionStatusBadge({ status, className }: SubmissionStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
