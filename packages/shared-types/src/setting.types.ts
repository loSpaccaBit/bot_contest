import type { SettingType } from './enums';

export interface SystemSettingDto {
  id: string;
  key: string;
  value: string;
  type: SettingType;
  description?: string | null;
  updatedAt: Date;
  // Parsed value based on type
  parsedValue?: string | number | boolean | Record<string, unknown>;
}

export interface UpdateSystemSettingDto {
  value: string;
}

export interface BulkUpdateSettingsDto {
  settings: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Known system setting keys.
 */
export const SYSTEM_SETTING_KEYS = {
  APP_NAME: 'app_name',
  LEADERBOARD_PUBLIC: 'leaderboard_public',
  MAX_SUBMISSIONS_PER_DAY: 'max_submissions_per_day',
  CONTEST_DESCRIPTION: 'contest_description',
} as const;

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[keyof typeof SYSTEM_SETTING_KEYS];
