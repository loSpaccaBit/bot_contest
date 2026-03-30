import { validateWorkerEnv } from '@domusbet/config';
import type { WorkerEnv } from '@domusbet/config';

let config: WorkerEnv | null = null;

export function getWorkerConfig(): WorkerEnv {
  if (!config) {
    config = validateWorkerEnv(process.env);
  }
  return config;
}

export { type WorkerEnv };
