import { OrderStatusService } from '../../../../src/domain/services/order-status.service';

describe('OrderStatusService', () => {
  const service = new OrderStatusService();

  it('maps APPROVED provider status to APPROVED', () => {
    expect(service.mapProviderStatus('APPROVED')).toBe('APPROVED');
    expect(service.mapProviderStatus('approved')).toBe('APPROVED');
  });

  it('maps DECLINED-like statuses to DECLINED', () => {
    expect(service.mapProviderStatus('DECLINED')).toBe('DECLINED');
    expect(service.mapProviderStatus('VOIDED')).toBe('DECLINED');
    expect(service.mapProviderStatus('ERROR')).toBe('DECLINED');
  });

  it('maps unknown status to PENDING', () => {
    expect(service.mapProviderStatus('PENDING')).toBe('PENDING');
    expect(service.mapProviderStatus('SOMETHING_ELSE')).toBe('PENDING');
  });
});
