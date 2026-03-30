import type { PaginationQuery, PaginatedResponse } from '@domusbet/shared-types';

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<never>['meta'] {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function normalizePaginationQuery(
  query: PaginationQuery,
): Required<Pick<PaginationQuery, 'page' | 'limit'>> {
  return {
    page: Math.max(1, query.page ?? 1),
    limit: Math.min(100, Math.max(1, query.limit ?? 20)),
  };
}

export function getPrismaSkipTake(page: number, limit: number): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Builds a paginated response object from raw data array and metadata.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}
