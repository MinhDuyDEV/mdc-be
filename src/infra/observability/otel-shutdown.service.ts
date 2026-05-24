import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import type { NodeSDK } from '@opentelemetry/sdk-node';

interface OpenTelemetryGlobal {
  __mdcOtelSdk?: Pick<NodeSDK, 'shutdown'>;
  __mdcOtelStarted?: boolean;
}

function getOpenTelemetryGlobal(): typeof globalThis & OpenTelemetryGlobal {
  return globalThis;
}

@Injectable()
export class OtelShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(OtelShutdownService.name);

  async onApplicationShutdown(): Promise<void> {
    const otelGlobal = getOpenTelemetryGlobal();
    if (!otelGlobal.__mdcOtelSdk || !otelGlobal.__mdcOtelStarted) {
      return;
    }

    try {
      await otelGlobal.__mdcOtelSdk.shutdown();
    } catch (err: unknown) {
      const trace = err instanceof Error ? err.stack : String(err);
      this.logger.error('Error during OpenTelemetry shutdown', trace);
    } finally {
      otelGlobal.__mdcOtelStarted = false;
    }
  }
}
