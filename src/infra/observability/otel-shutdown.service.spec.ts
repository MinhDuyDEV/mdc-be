import { OtelShutdownService } from './otel-shutdown.service';

interface TestOtelGlobal {
  __mdcOtelSdk?: {
    shutdown: jest.Mock<Promise<void>, []>;
  };
  __mdcOtelStarted?: boolean;
}

const otelGlobal = globalThis as typeof globalThis & TestOtelGlobal;

describe('OtelShutdownService', () => {
  afterEach(() => {
    delete otelGlobal.__mdcOtelSdk;
    delete otelGlobal.__mdcOtelStarted;
  });

  it('shuts down a started OpenTelemetry SDK', async () => {
    const shutdown = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    otelGlobal.__mdcOtelSdk = { shutdown };
    otelGlobal.__mdcOtelStarted = true;

    await new OtelShutdownService().onApplicationShutdown();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(otelGlobal.__mdcOtelStarted).toBe(false);
  });

  it('does nothing when instrumentation did not start the SDK', async () => {
    const shutdown = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    otelGlobal.__mdcOtelSdk = { shutdown };
    otelGlobal.__mdcOtelStarted = false;

    await new OtelShutdownService().onApplicationShutdown();

    expect(shutdown).not.toHaveBeenCalled();
  });
});
