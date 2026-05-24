import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { resolveOtelExporterOtlpEndpoint } from './instrumentation.config';

interface OpenTelemetryGlobal {
  __mdcOtelSdk?: NodeSDK;
  __mdcOtelStarted?: boolean;
}

function loadPackageJsonVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(
      readFileSync(pkgPath, { encoding: 'utf-8' }),
    ) as Record<string, unknown>;
    return (pkg.version as string) || '0.0.1';
  } catch {
    return '0.0.1';
  }
}

function getInstrumentations() {
  const autoInstrumentations = getNodeAutoInstrumentations({
    // Disable noisy fs instrumentation
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    // Ignore health check requests to reduce noise
    '@opentelemetry/instrumentation-http': {
      ignoreIncomingRequestHook: (request: import('http').IncomingMessage) => {
        const url = request.url ?? '';
        return /^\/health\/(live|ready)$/.test(url);
      },
    },
  });

  return [...autoInstrumentations, new PrismaInstrumentation()];
}

const isDevelopment = process.env.NODE_ENV === 'development';
const serviceName = process.env.OTEL_SERVICE_NAME || 'mdc-be';
const serviceVersion = loadPackageJsonVersion();
const otlpEndpoint = resolveOtelExporterOtlpEndpoint(process.env);

function createTraceExporter() {
  if (isDevelopment) {
    return new ConsoleSpanExporter();
  }

  return new OTLPTraceExporter({
    url: otlpEndpoint,
  });
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  traceExporter: createTraceExporter(),
  metricReader: isDevelopment
    ? undefined
    : new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: otlpEndpoint,
        }),
      }),
  instrumentations: getInstrumentations(),
});

const otelGlobal = globalThis as typeof globalThis & OpenTelemetryGlobal;
if (!otelGlobal.__mdcOtelStarted) {
  sdk.start();
  otelGlobal.__mdcOtelSdk = sdk;
  otelGlobal.__mdcOtelStarted = true;
}
