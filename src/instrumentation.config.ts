export interface InstrumentationEnv {
  NODE_ENV?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
}

export function resolveOtelExporterOtlpEndpoint(
  env: InstrumentationEnv,
): string | undefined {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'OTEL_EXPORTER_OTLP_ENDPOINT is required when NODE_ENV=production',
      );
    }
    return undefined;
  }

  try {
    new URL(endpoint);
  } catch {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL');
  }

  return endpoint;
}
