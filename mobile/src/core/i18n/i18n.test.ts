import { t } from './index';

describe('i18n', () => {
  it('dosadí proměnné', () => {
    expect(t('Prodáno {0} ks', 3)).toMatch(/3/);
  });
});
