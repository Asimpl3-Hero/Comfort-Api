import { HealthController } from '../../../../../src/infrastructure/adapters/http/health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('returns root payload with service links', () => {
    expect(controller.getRoot()).toEqual({
      service: 'Comfort API',
      status: 'ok',
      docs_url: '/docs',
      health_url: '/health',
    });
  });

  it('returns health payload with timestamp and uptime', () => {
    const response = controller.getHealth();

    expect(response.status).toBe('ok');
    expect(typeof response.timestamp).toBe('string');
    expect(typeof response.uptime_in_seconds).toBe('number');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
    expect(response.uptime_in_seconds).toBeGreaterThanOrEqual(0);
  });
});
