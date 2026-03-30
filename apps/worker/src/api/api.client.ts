import axios, { type AxiosInstance } from 'axios';
import { getWorkerConfig } from '../config/worker.config';
import type {
  LeaderboardDto,
  DashboardMetricsDto,
} from '@domusbet/shared-types';

let client: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (!client) {
    const config = getWorkerConfig();

    client = axios.create({
      baseURL: `${config.WORKER_API_URL}/api`,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': config.WORKER_API_INTERNAL_SECRET,
      },
    });

    client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.message ?? error.message;
        return Promise.reject(
          new Error(`API error [${status ?? 'network'}]: ${message}`)
        );
      }
    );
  }

  return client;
}

export async function fetchLeaderboard(): Promise<LeaderboardDto> {
  const api = getApiClient();
  const response = await api.get<LeaderboardDto>('/internal/leaderboard');
  return response.data;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetricsDto> {
  const api = getApiClient();
  const response = await api.get<DashboardMetricsDto>('/internal/dashboard/metrics');
  return response.data;
}
