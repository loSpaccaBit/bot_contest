// Username utilities
export {
  normalizeDomusbetUsername,
  isValidDomusbetUsername,
  formatDisplayName,
  formatTelegramUsername,
} from './username.utils';

// Template utilities
export {
  parseTemplate,
  extractTemplatePlaceholders,
  validateTemplatePlaceholders,
  escapeTelegramMarkdownV2,
  parseTemplateMarkdownV2,
} from './template.utils';

// Pagination utilities
export {
  buildPaginationMeta,
  normalizePaginationQuery,
  getPrismaSkipTake,
  buildPaginatedResponse,
} from './pagination.utils';

// Error utilities
export {
  AppError,
  DuplicateSubmissionError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  RateLimitError,
  ExternalServiceError,
  isAppError,
  extractErrorMessage,
} from './error.utils';

// Date utilities
export {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  toISODateString,
  parseDate,
  isSameDay,
} from './date.utils';
