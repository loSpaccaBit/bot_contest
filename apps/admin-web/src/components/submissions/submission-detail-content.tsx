'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Award, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmission, useApproveSubmission, useRejectSubmission, useAssignPoints, useUnapproveSubmission, useDeleteScoreMovement } from '@/hooks/use-submissions';
import { useScoreRules } from '@/hooks/use-score-rules';
import { PageLoader } from '@/components/common/loading-spinner';
import { SubmissionStatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/utils';
import { SubmissionStatus } from '@domusbet/shared-types';

const rejectSchema = z.object({
  rejectionReason: z.string().min(1, 'Motivo obbligatorio'),
  adminNotes: z.string().optional(),
});

const assignPointsSchema = z.object({
  scoreRuleCode: z.string().min(1, 'Regola obbligatoria'),
  customPoints: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).optional(),
  ),
  reason: z.string().optional(),
});

type RejectFormData = z.infer<typeof rejectSchema>;
type AssignPointsFormData = z.infer<typeof assignPointsSchema>;

interface SubmissionDetailContentProps {
  id: string;
}

export function SubmissionDetailContent({ id }: SubmissionDetailContentProps) {
  const router = useRouter();
  const { data: submission, isLoading } = useSubmission(id);
  const { data: scoreRules } = useScoreRules();
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const assignPoints = useAssignPoints();
  const unapprove = useUnapproveSubmission();
  const deleteMovement = useDeleteScoreMovement();

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');

  const rejectForm = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
  });

  const assignForm = useForm<AssignPointsFormData>({
    resolver: zodResolver(assignPointsSchema),
  });

  if (isLoading || !submission) return <PageLoader />;

  const isPending = submission.status === SubmissionStatus.PENDING;
  const isApproved = submission.status === SubmissionStatus.APPROVED;

  const handleApprove = () => {
    approve.mutate({ id, dto: { adminNotes: approveNotes || undefined } });
  };

  const handleReject = (data: RejectFormData) => {
    reject.mutate({ id, dto: data }, { onSuccess: () => setShowRejectForm(false) });
  };

  const handleAssignPoints = (data: AssignPointsFormData) => {
    assignPoints.mutate(
      { id, dto: data },
      {
        onSuccess: () => {
          setShowAssignForm(false);
          assignForm.reset();
        },
      },
    );
  };

  const handleUnapprove = () => {
    unapprove.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Indietro
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Segnalazione: {submission.domusbetUsername}
          </h2>
          <p className="text-sm text-slate-500">ID: {submission.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dettagli segnalazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-500">Username Domusbet</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{submission.domusbetUsername}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Stato</dt>
                  <dd className="mt-1">
                    <SubmissionStatusBadge status={submission.status} />
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Referente</dt>
                  <dd className="mt-1 text-slate-900">{submission.referrerFirstName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Telegram ID Referente</dt>
                  <dd className="mt-1 font-mono text-slate-700 text-xs">{submission.referrerTelegramId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Punti totali</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {submission.totalPoints != null ? `${submission.totalPoints} pt` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Data creazione</dt>
                  <dd className="mt-1 text-slate-700">{formatDate(submission.createdAt)}</dd>
                </div>
                {submission.reviewedByName && (
                  <>
                    <div>
                      <dt className="font-medium text-slate-500">Revisionato da</dt>
                      <dd className="mt-1 text-slate-700">{submission.reviewedByName}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Data revisione</dt>
                      <dd className="mt-1 text-slate-700">
                        {submission.reviewedAt ? formatDate(submission.reviewedAt) : '—'}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              {submission.adminNotes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-slate-500">Note admin</p>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                      {submission.adminNotes}
                    </p>
                  </div>
                </>
              )}

              {submission.rejectionReason && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-red-500">Motivo rifiuto</p>
                    <p className="mt-1 text-sm text-red-700 whitespace-pre-wrap">
                      {submission.rejectionReason}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Score Movements */}
          {submission.scoreMovements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Punti assegnati</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {submission.scoreMovements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <div>
                      <span className="text-sm font-semibold text-blue-600">+{m.points} pt</span>
                      {m.scoreRuleName && (
                        <span className="ml-2 text-xs text-slate-500">{m.scoreRuleName}</span>
                      )}
                      {m.reason && !m.scoreRuleName && (
                        <span className="ml-2 text-xs text-slate-500">{m.reason}</span>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(m.createdAt)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMovement.mutate({ submissionId: id, movementId: m.id })}
                      disabled={deleteMovement.isPending}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          {submission.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cronologia eventi</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative border-l border-slate-200 space-y-4 pl-4">
                  {submission.events.map((event) => {
                    const p = event.payload as Record<string, unknown> | null | undefined;
                    const dotColor =
                      event.eventType === 'POINTS_ASSIGNED'
                        ? 'bg-yellow-400'
                        : event.eventType === 'STATUS_CHANGED' && p?.to === 'APPROVED'
                          ? 'bg-green-500'
                          : event.eventType === 'STATUS_CHANGED' && p?.to === 'REJECTED'
                            ? 'bg-red-500'
                            : event.eventType === 'STATUS_CHANGED' && p?.to === 'PENDING'
                              ? 'bg-amber-400'
                              : 'bg-blue-500';

                    let label: string = event.eventType;
                    let detail: string | null = null;

                    if (event.eventType === 'CREATED') {
                      label = 'Segnalazione creata';
                    } else if (event.eventType === 'STATUS_CHANGED') {
                      const to = p?.to as string | undefined;
                      label =
                        to === 'APPROVED'
                          ? 'Approvata'
                          : to === 'REJECTED'
                            ? 'Rifiutata'
                            : to === 'PENDING'
                              ? 'Approvazione annullata'
                              : `Stato → ${to ?? '?'}`;
                      if (p?.rejectionReason) detail = String(p.rejectionReason);
                      else if (p?.adminNotes) detail = String(p.adminNotes);
                      else if (p?.scorePoints) detail = `${String(p.scorePoints)} pt assegnati automaticamente`;
                    } else if (event.eventType === 'POINTS_ASSIGNED') {
                      const pts = p?.points != null ? `${String(p.points)} pt` : '';
                      const ruleName = p?.scoreRuleName ? String(p.scoreRuleName) : (p?.scoreRuleCode ? String(p.scoreRuleCode) : null);
                      label = `Punti assegnati${pts ? ` · ${pts}` : ''}`;
                      detail = ruleName ?? (p?.reason ? String(p.reason) : null);
                    }

                    return (
                      <li key={event.id} className="ml-3">
                        <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`} />
                        <p className="text-sm font-medium text-slate-900">{label}</p>
                        {detail && <p className="text-xs text-slate-600 mt-0.5">{detail}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(event.createdAt)}</p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {isPending && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Azioni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Approve */}
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Note approvazione (opzionale)</Label>
                  <Textarea
                    placeholder="Note per l'approvazione..."
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    onClick={handleApprove}
                    disabled={approve.isPending}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {approve.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approva
                  </Button>
                </div>

                <Separator />

                {/* Reject */}
                {!showRejectForm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectForm(true)}
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rifiuta
                  </Button>
                ) : (
                  <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Motivo rifiuto *</Label>
                      <Textarea
                        placeholder="Motivo obbligatorio..."
                        rows={3}
                        className="text-sm"
                        {...rejectForm.register('rejectionReason')}
                      />
                      {rejectForm.formState.errors.rejectionReason && (
                        <p className="text-xs text-red-500">
                          {rejectForm.formState.errors.rejectionReason.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Note admin (opzionale)</Label>
                      <Textarea
                        placeholder="Note interne..."
                        rows={2}
                        className="text-sm"
                        {...rejectForm.register('adminNotes')}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={reject.isPending}
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        {reject.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Conferma
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRejectForm(false)}
                      >
                        Annulla
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unapprove */}
          {isApproved && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gestione stato</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleUnapprove}
                  disabled={unapprove.isPending}
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  {unapprove.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Annulla approvazione
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Assign Points */}
          {isApproved && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assegna punti</CardTitle>
              </CardHeader>
              <CardContent>
                {!showAssignForm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowAssignForm(true)}
                    className="w-full"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Assegna punti
                  </Button>
                ) : (
                  <form onSubmit={assignForm.handleSubmit(handleAssignPoints)} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Regola punteggio *</Label>
                      <Select
                        onValueChange={(v) => assignForm.setValue('scoreRuleCode', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regola..." />
                        </SelectTrigger>
                        <SelectContent>
                          {scoreRules?.map((rule) => (
                            <SelectItem key={rule.id} value={rule.code}>
                              {rule.name} ({rule.points} pt)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assignForm.formState.errors.scoreRuleCode && (
                        <p className="text-xs text-red-500">
                          {assignForm.formState.errors.scoreRuleCode.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Punti personalizzati (opzionale)</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Lascia vuoto per usare i punti della regola"
                        className="text-sm"
                        {...assignForm.register('customPoints')}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={assignPoints.isPending}
                        size="sm"
                        className="flex-1"
                      >
                        {assignPoints.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        )}
                        Assegna
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignForm(false)}
                      >
                        Annulla
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
