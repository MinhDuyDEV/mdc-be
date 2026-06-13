import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('recordHttpRequest', () => {
    it('exposes incremented counter in Prometheus text format', async () => {
      service.recordHttpRequest('GET', '/api/v1/users', 200, 42);
      service.recordHttpRequest('GET', '/api/v1/users', 200, 50);
      service.recordHttpRequest('POST', '/api/v1/users', 201, 80);

      const text = await service.getMetrics();

      expect(text).toContain('http_requests_total');
      // Prometheus emits one line per label combination: GET+200=2, POST+201=1.
      expect(text).toMatch(
        /http_requests_total\{[^}]*status_code="200"[^}]*\}\s+2/,
      );
      expect(text).toMatch(
        /http_requests_total\{[^}]*status_code="201"[^}]*\}\s+1/,
      );
    });

    it('records duration observations in histogram', async () => {
      service.recordHttpRequest('GET', '/api/v1/users', 200, 42);

      const text = await service.getMetrics();

      expect(text).toContain('http_request_duration_seconds');
      // Histogram exposes _sum, _count, _bucket series.
      expect(text).toMatch(/http_request_duration_seconds_count\{[^}]*\}\s+1/);
    });
  });

  describe('recordSubscriptionChange', () => {
    it('increments subscription counter with status label', async () => {
      service.recordSubscriptionChange('active');
      service.recordSubscriptionChange('cancelled');

      const text = await service.getMetrics();

      expect(text).toMatch(
        /subscriptions_total\{[^}]*status="active"[^}]*\}\s+1/,
      );
      expect(text).toMatch(
        /subscriptions_total\{[^}]*status="cancelled"[^}]*\}\s+1/,
      );
    });
  });

  describe('recordOutboxEvent', () => {
    it('increments outbox event counter with event type and status labels', async () => {
      service.recordOutboxEvent('UserRegistered', 'processed');
      service.recordOutboxEvent('UserRegistered', 'processed');
      service.recordOutboxEvent('UserRegistered', 'failed');

      const text = await service.getMetrics();

      expect(text).toMatch(
        /outbox_events_total\{[^}]*event_type="UserRegistered"[^}]*status="processed"[^}]*\}\s+2/,
      );
      expect(text).toMatch(
        /outbox_events_total\{[^}]*event_type="UserRegistered"[^}]*status="failed"[^}]*\}\s+1/,
      );
    });
  });

  describe('recordMediaUpload', () => {
    it('increments media upload counter with purpose and status labels', async () => {
      service.recordMediaUpload('avatar', 'ready');
      service.recordMediaUpload('avatar', 'quarantined');

      const text = await service.getMetrics();

      expect(text).toMatch(
        /media_uploads_total\{[^}]*purpose="avatar"[^}]*status="ready"[^}]*\}\s+1/,
      );
      expect(text).toMatch(
        /media_uploads_total\{[^}]*purpose="avatar"[^}]*status="quarantined"[^}]*\}\s+1/,
      );
    });
  });

  describe('recordDsrRequest', () => {
    it('increments DSR counter with type and status labels', async () => {
      service.recordDsrRequest('EXPORT', 'PENDING');

      const text = await service.getMetrics();

      expect(text).toMatch(
        /dsr_requests_total\{[^}]*type="EXPORT"[^}]*status="PENDING"[^}]*\}\s+1/,
      );
    });
  });

  describe('recordAuditLogEntry', () => {
    it('increments audit log counter', async () => {
      service.recordAuditLogEntry();
      service.recordAuditLogEntry();
      service.recordAuditLogEntry();

      const text = await service.getMetrics();

      expect(text).toMatch(/audit_log_entries_total\s+3/);
    });
  });

  describe('onApplicationShutdown', () => {
    it('clears the registry without throwing', () => {
      expect(() => service.onApplicationShutdown()).not.toThrow();
    });
  });
});
