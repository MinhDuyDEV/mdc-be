import { resolveOtelExporterOtlpEndpoint } from './instrumentation.config';

describe('resolveOtelExporterOtlpEndpoint', () => {
  it('requires an OTLP endpoint in production', () => {
    expect(() =>
      resolveOtelExporterOtlpEndpoint({ NODE_ENV: 'production' }),
    ).toThrow('OTEL_EXPORTER_OTLP_ENDPOINT is required');
  });

  it('allows a missing endpoint outside production', () => {
    expect(
      resolveOtelExporterOtlpEndpoint({ NODE_ENV: 'test' }),
    ).toBeUndefined();
  });

  it('rejects malformed endpoint URLs', () => {
    expect(() =>
      resolveOtelExporterOtlpEndpoint({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url',
      }),
    ).toThrow('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL');
  });

  it('returns a trimmed valid endpoint URL', () => {
    expect(
      resolveOtelExporterOtlpEndpoint({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_ENDPOINT: ' https://otel.example.test/v1/traces ',
      }),
    ).toBe('https://otel.example.test/v1/traces');
  });
});
