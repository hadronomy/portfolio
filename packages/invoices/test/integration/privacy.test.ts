import { specimen } from '@portfolio/invoices/fixtures';
import { defaultPreferences } from '@portfolio/invoices/model';
import { privacyController } from '@portfolio/invoices/privacy';
import { InvoiceStore } from '@portfolio/invoices/store';
import { testRuntime } from '@portfolio/invoices/testing';
import { afterAll, describe, expect, it } from 'vitest';

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
