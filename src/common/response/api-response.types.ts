export interface ApiResponseMeta {
  [key: string]: unknown;
}

export interface ApiSuccessResponse<TData = unknown, TMeta extends ApiResponseMeta = ApiResponseMeta> {
  data: TData;
  meta?: TMeta;
}

export function createApiResponse<TData, TMeta extends ApiResponseMeta = ApiResponseMeta>(
  data: TData,
  meta?: TMeta,
): ApiSuccessResponse<TData, TMeta> {
  return meta === undefined ? { data } : { data, meta };
}

export function isApiSuccessResponse(value: unknown): value is ApiSuccessResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    !('error' in value)
  );
}
