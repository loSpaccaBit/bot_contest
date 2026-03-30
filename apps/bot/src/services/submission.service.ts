import { isAxiosError } from 'axios';
import type { ApiClient } from '../api/api.client';
import type pino from 'pino';

export interface CreateSubmissionResult {
  success: boolean;
  isDuplicate: boolean;
  submission?: unknown;
}

export class SubmissionService {
  private readonly logger: pino.Logger;

  constructor(
    private readonly apiClient: ApiClient,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ context: 'SubmissionService' });
  }

  /**
   * Attempts to create a submission for the given Telegram user.
   *
   * Returns:
   *  - `{ success: true, isDuplicate: false, submission }` on success
   *  - `{ success: false, isDuplicate: true }` when already submitted
   *  - `{ success: false, isDuplicate: false }` on any other error
   */
  async createSubmission(
    telegramId: string,
    domusbetUsername: string,
    referrerData: {
      telegramUsername?: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<CreateSubmissionResult> {
    try {
      // Ensure the referrer exists / is up-to-date before creating the submission
      await this.apiClient.syncReferrer({
        telegramId,
        telegramUsername: referrerData.telegramUsername,
        firstName: referrerData.firstName,
        lastName: referrerData.lastName,
      });

      const submission = await this.apiClient.createSubmission({
        domusbetUsername,
        telegramId,
        telegramUsername: referrerData.telegramUsername,
        firstName: referrerData.firstName,
        lastName: referrerData.lastName,
      });

      this.logger.info(
        { telegramId, domusbetUsername, submissionId: submission.id },
        'Submission created successfully',
      );

      return { success: true, isDuplicate: false, submission };
    } catch (err) {
      // 409 Conflict → duplicate submission
      if (isAxiosError(err) && err.response?.status === 409) {
        this.logger.info(
          { telegramId, domusbetUsername },
          'Duplicate submission detected',
        );
        return { success: false, isDuplicate: true };
      }

      this.logger.error(
        { err, telegramId, domusbetUsername },
        'Failed to create submission',
      );
      return { success: false, isDuplicate: false };
    }
  }
}
