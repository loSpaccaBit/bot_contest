import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  LoginDto,
  AuthenticatedAdminDto,
  TokensDto,
  AdminDto,
  CreateAdminDto,
  UpdateAdminDto,
  AdminFiltersDto,
  SubmissionDto,
  SubmissionFiltersDto,
  SubmissionWithEventsDto,
  ApproveSubmissionDto,
  RejectSubmissionDto,
  AssignPointsDto,
  ReferrerDto,
  ReferrerFiltersDto,
  LeaderboardDto,
  ScoreRuleDto,
  CreateScoreRuleDto,
  UpdateScoreRuleDto,
  BotMessageTemplateDto,
  UpdateBotMessageTemplateDto,
  SystemSettingDto,
  UpdateSystemSettingDto,
  BulkUpdateSettingsDto,
  DashboardMetricsDto,
  AuditLogDto,
  AuditLogFiltersDto,
  PaginatedResponse,
  PaginationQuery,
} from '@domusbet/shared-types';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
} from './auth';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api`;

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void): void {
  refreshSubscribers.push(cb);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap { success: true, data: T } envelope + handle 401/refresh
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();

      if (!refreshToken || isTokenExpired(refreshToken)) {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken,
        });

        // Unwrap NestJS envelope { success, data: TokensDto } manually (bare axios, no interceptor)
        const tokens: TokensDto = response.data?.data ?? response.data;
        const { accessToken, refreshToken: newRefreshToken } = tokens;
        setTokens(accessToken, newRefreshToken);
        onRefreshed(accessToken);

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (dto: LoginDto): Promise<AuthenticatedAdminDto> => {
    const res = await apiClient.post<AuthenticatedAdminDto>('/auth/login', dto);
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<AdminDto> => {
    const res = await apiClient.get<AdminDto>('/auth/me');
    return res.data;
  },

  refreshTokens: async (refreshToken: string): Promise<TokensDto> => {
    const res = await apiClient.post<TokensDto>('/auth/refresh', { refreshToken });
    return res.data;
  },
};

// ─── Submissions ──────────────────────────────────────────────────────────
export const submissionsApi = {
  getAll: async (filters?: SubmissionFiltersDto): Promise<PaginatedResponse<SubmissionDto>> => {
    const res = await apiClient.get<PaginatedResponse<SubmissionDto>>('/submissions', {
      params: filters,
    });
    return res.data;
  },

  getById: async (id: string): Promise<SubmissionWithEventsDto> => {
    const res = await apiClient.get<SubmissionWithEventsDto>(`/submissions/${id}`);
    return res.data;
  },

  approve: async (id: string, dto: Omit<ApproveSubmissionDto, 'submissionId'>): Promise<SubmissionDto> => {
    const res = await apiClient.patch<SubmissionDto>(`/submissions/${id}/approve`, dto);
    return res.data;
  },

  reject: async (id: string, dto: Omit<RejectSubmissionDto, 'submissionId'>): Promise<SubmissionDto> => {
    const res = await apiClient.patch<SubmissionDto>(`/submissions/${id}/reject`, dto);
    return res.data;
  },

  assignPoints: async (id: string, dto: Omit<AssignPointsDto, 'submissionId'>): Promise<SubmissionDto> => {
    const res = await apiClient.post<SubmissionDto>(`/submissions/${id}/points`, dto);
    return res.data;
  },

  unapprove: async (id: string): Promise<SubmissionDto> => {
    const res = await apiClient.patch<SubmissionDto>(`/submissions/${id}/unapprove`);
    return res.data;
  },

  deleteScoreMovement: async (submissionId: string, movementId: string): Promise<void> => {
    await apiClient.delete(`/submissions/${submissionId}/points/${movementId}`);
  },
};

// ─── Referrers ────────────────────────────────────────────────────────────
export const referrersApi = {
  getAll: async (filters?: ReferrerFiltersDto): Promise<PaginatedResponse<ReferrerDto>> => {
    const res = await apiClient.get<PaginatedResponse<ReferrerDto>>('/referrers', {
      params: filters,
    });
    return res.data;
  },

  getById: async (id: string): Promise<ReferrerDto> => {
    const res = await apiClient.get<ReferrerDto>(`/referrers/${id}`);
    return res.data;
  },
};

// ─── Leaderboard ──────────────────────────────────────────────────────────
export const leaderboardApi = {
  get: async (query?: PaginationQuery): Promise<LeaderboardDto> => {
    const res = await apiClient.get<LeaderboardDto>('/leaderboard', { params: query });
    return res.data;
  },
};

// ─── Score Rules ──────────────────────────────────────────────────────────
export const scoreRulesApi = {
  getAll: async (): Promise<ScoreRuleDto[]> => {
    const res = await apiClient.get<ScoreRuleDto[]>('/score-rules');
    return res.data;
  },

  create: async (dto: CreateScoreRuleDto): Promise<ScoreRuleDto> => {
    const res = await apiClient.post<ScoreRuleDto>('/score-rules', dto);
    return res.data;
  },

  update: async (id: string, dto: UpdateScoreRuleDto): Promise<ScoreRuleDto> => {
    const res = await apiClient.patch<ScoreRuleDto>(`/score-rules/${id}`, dto);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/score-rules/${id}`);
  },
};

// ─── Bot Messages ─────────────────────────────────────────────────────────
export const botMessagesApi = {
  getAll: async (): Promise<BotMessageTemplateDto[]> => {
    const res = await apiClient.get<BotMessageTemplateDto[]>('/bot-messages');
    return res.data;
  },

  update: async (id: string, dto: UpdateBotMessageTemplateDto): Promise<BotMessageTemplateDto> => {
    const res = await apiClient.patch<BotMessageTemplateDto>(`/bot-messages/${id}`, dto);
    return res.data;
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────
export const settingsApi = {
  getAll: async (): Promise<SystemSettingDto[]> => {
    const res = await apiClient.get<SystemSettingDto[]>('/settings');
    return res.data;
  },

  update: async (key: string, dto: UpdateSystemSettingDto): Promise<SystemSettingDto> => {
    const res = await apiClient.patch<SystemSettingDto>(`/settings/${key}`, dto);
    return res.data;
  },

  bulkUpdate: async (dto: BulkUpdateSettingsDto): Promise<SystemSettingDto[]> => {
    const res = await apiClient.patch<SystemSettingDto[]>('/settings', dto);
    return res.data;
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────
export const dashboardApi = {
  getMetrics: async (): Promise<DashboardMetricsDto> => {
    const res = await apiClient.get<DashboardMetricsDto>('/dashboard');
    return res.data;
  },
};

// ─── Audit Logs ───────────────────────────────────────────────────────────
export const auditLogsApi = {
  getAll: async (filters?: AuditLogFiltersDto): Promise<PaginatedResponse<AuditLogDto>> => {
    const res = await apiClient.get<PaginatedResponse<AuditLogDto>>('/audit-logs', {
      params: filters,
    });
    return res.data;
  },
};

// ─── Leaderboard Templates ────────────────────────────────────────────────

export interface TextPosition {
  rank: number;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  fontFamily: string;
}

export interface LeaderboardTemplateDto {
  id: string;
  name: string;
  imagePath: string;
  imageUrl: string;       // computed client-side from imagePath
  isActive: boolean;
  positions: TextPosition[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLeaderboardTemplateDto {
  name?: string;
  isActive?: boolean;
  positions?: TextPosition[];
}

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function withImageUrl(t: Omit<LeaderboardTemplateDto, 'imageUrl'> & { imagePath: string }): LeaderboardTemplateDto {
  return { ...t, imageUrl: `${API_ORIGIN}/${t.imagePath}` };
}

export const leaderboardTemplateApi = {
  getAll: async (): Promise<LeaderboardTemplateDto[]> => {
    const res = await apiClient.get<LeaderboardTemplateDto[]>('/leaderboard/template');
    return res.data.map(withImageUrl);
  },

  create: async (name: string, image: File): Promise<LeaderboardTemplateDto> => {
    const formData = new FormData();
    formData.append('image', image);
    const res = await apiClient.post<LeaderboardTemplateDto>(
      `/leaderboard/template?name=${encodeURIComponent(name)}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return withImageUrl(res.data);
  },

  update: async (id: string, dto: UpdateLeaderboardTemplateDto): Promise<LeaderboardTemplateDto> => {
    const res = await apiClient.put<LeaderboardTemplateDto>(`/leaderboard/template/${id}`, dto);
    return withImageUrl(res.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/leaderboard/template/${id}`);
  },
};

// ─── Admins ───────────────────────────────────────────────────────────────
export const adminsApi = {
  getAll: async (filters?: AdminFiltersDto): Promise<PaginatedResponse<AdminDto>> => {
    const res = await apiClient.get<PaginatedResponse<AdminDto>>('/admins', {
      params: filters,
    });
    return res.data;
  },

  create: async (dto: CreateAdminDto): Promise<AdminDto> => {
    const res = await apiClient.post<AdminDto>('/admins', dto);
    return res.data;
  },

  update: async (id: string, dto: UpdateAdminDto): Promise<AdminDto> => {
    const res = await apiClient.patch<AdminDto>(`/admins/${id}`, dto);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/admins/${id}`);
  },
};
