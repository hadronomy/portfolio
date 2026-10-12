import { afterAll, describe, expect, it } from 'vitest';
import { specimen } from './fixtures';
import { defaultPreferences } from './model';
import { privacyController } from './privacy';
import { InvoiceStore } from './store';
import { testRuntime } from './testing';

const runtime = testRuntime();
afterAll(() => runtime.dispose());

describe('public privacy controller', () => {
  it('reads saved identity without publishing private issuer settings', async () => {
    expect(await runtime.runPromise(privacyController())).toBeNull();
    const issuer = specimen().data.issuer;
    await runtime.runPromise(
      InvoiceStore.use((store) =>
        store.preferences({ ...defaultPreferences, issuer }),
      ),
    );
    expect(await runtime.runPromise(privacyController())).toEqual({
      name: issuer.name,
      taxId: issuer.taxId,
      email: issuer.email,
      address: issuer.address,
    });
    const changed = {
      ...issuer,
      name: 'Nombre actualizado',
      email: 'new@example.org',
    };
    await runtime.runPromise(
      InvoiceStore.use((store) =>
        store.preferences({ ...defaultPreferences, issuer: changed }),
      ),
    );
    const controller = await runtime.runPromise(privacyController());
    expect(controller?.name).toBe(changed.name);
    expect(controller?.email).toBe(changed.email);
    expect(controller).not.toHaveProperty('iban');
  }, 20000);
});
