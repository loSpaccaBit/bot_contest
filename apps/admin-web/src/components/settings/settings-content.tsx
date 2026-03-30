'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useSettings, useUpdateSetting } from '@/hooks/use-settings';
import { PageHeader } from '@/components/common/page-header';
import { PageLoader } from '@/components/common/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SettingType } from '@domusbet/shared-types';
import type { SystemSettingDto } from '@domusbet/shared-types';

function SettingRow({ setting }: { setting: SystemSettingDto }) {
  const updateSetting = useUpdateSetting();

  const handleChange = (value: string) => {
    updateSetting.mutate({ key: setting.key, dto: { value } });
  };

  const handleBoolToggle = (checked: boolean) => {
    handleChange(checked ? 'true' : 'false');
  };

  const label = (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-slate-900">{setting.key}</p>
      {setting.description && (
        <p className="text-xs text-slate-500">{setting.description}</p>
      )}
    </div>
  );

  if (setting.type === SettingType.BOOLEAN) {
    const boolVal = setting.value === 'true';
    return (
      <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
        {label}
        <Switch
          checked={boolVal}
          onCheckedChange={handleBoolToggle}
          disabled={updateSetting.isPending}
        />
      </div>
    );
  }

  if (setting.type === SettingType.STRING && setting.key.toLowerCase().includes('description')) {
    return (
      <div className="space-y-2 py-3 border-b border-slate-100 last:border-0">
        {label}
        <SettingTextarea setting={setting} onSave={handleChange} isSaving={updateSetting.isPending} />
      </div>
    );
  }

  return (
    <div className="space-y-2 py-3 border-b border-slate-100 last:border-0">
      {label}
      <SettingInput setting={setting} onSave={handleChange} isSaving={updateSetting.isPending} />
    </div>
  );
}

function SettingInput({
  setting,
  onSave,
  isSaving,
}: {
  setting: SystemSettingDto;
  onSave: (v: string) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit, reset } = useForm<{ value: string }>({
    defaultValues: { value: setting.value },
  });

  useEffect(() => {
    reset({ value: setting.value });
  }, [setting.value, reset]);

  return (
    <form
      onSubmit={handleSubmit((d) => onSave(d.value))}
      className="flex items-center gap-2"
    >
      <Input
        type={setting.type === SettingType.NUMBER ? 'number' : 'text'}
        className="flex-1"
        {...register('value')}
      />
      <Button type="submit" size="sm" disabled={isSaving} className="shrink-0">
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salva'}
      </Button>
    </form>
  );
}

function SettingTextarea({
  setting,
  onSave,
  isSaving,
}: {
  setting: SystemSettingDto;
  onSave: (v: string) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit, reset } = useForm<{ value: string }>({
    defaultValues: { value: setting.value },
  });

  useEffect(() => {
    reset({ value: setting.value });
  }, [setting.value, reset]);

  return (
    <form onSubmit={handleSubmit((d) => onSave(d.value))} className="space-y-2">
      <Textarea rows={3} {...register('value')} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Salva
        </Button>
      </div>
    </form>
  );
}

export function SettingsContent() {
  const { data: settings, isLoading } = useSettings();

  if (isLoading) return <PageLoader />;

  // Group settings by category (heuristic: prefix before underscore)
  const grouped = (settings ?? []).reduce<Record<string, SystemSettingDto[]>>((acc, s) => {
    const cat = s.key.split('_')[0] ?? 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impostazioni"
        description="Configura i parametri di sistema"
      />

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {items.map((setting) => (
              <SettingRow key={setting.id} setting={setting} />
            ))}
          </CardContent>
        </Card>
      ))}

      {(settings ?? []).length === 0 && (
        <p className="text-center text-slate-500 py-16">Nessuna impostazione configurata.</p>
      )}
    </div>
  );
}
