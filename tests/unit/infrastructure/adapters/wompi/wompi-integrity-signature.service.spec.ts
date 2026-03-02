import { createHash } from 'node:crypto';
import { AppConfigService } from '../../../../../src/infrastructure/config/app-config.service';
import { WompiIntegritySignatureService } from '../../../../../src/infrastructure/adapters/wompi/wompi-integrity-signature.service';

describe('WompiIntegritySignatureService', () => {
  it('builds expected sha256 signature', () => {
    const config = {
      wompiIntegritySecret: 'secret_123',
    } as AppConfigService;
    const service = new WompiIntegritySignatureService(config);

    const signature = service.build('ref-1', 1000, 'COP');
    const expected = createHash('sha256')
      .update('ref-11000COPsecret_123')
      .digest('hex');

    expect(signature).toBe(expected);
  });
});
