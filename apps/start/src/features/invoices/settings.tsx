import { Preferences } from '@portfolio/invoices/model';
import { useForm, useSelector } from '@tanstack/react-form';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { AgentsSettings } from './agents-settings';
import { languages } from './choices';
import { CoverPicker } from './cover-picker';
import { BankFields, PartyFields, TaxProfileFields } from './party-fields';
import { SeriesField } from './smart-fields';
import { useToast } from './toast';
import { Button, Field, MorphText, Select } from './ui';
import { useWorkspace } from './workspace';

export function Settings() {
  const { workspace, isError } = useWorkspace();
  if (!workspace)
    return (
      <output className="iv-message">
        {isError ? 'Settings could not load.' : 'Loading settings…'}
      </output>
    );
  return <SettingsForm initial={workspace.preferences} />;
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="iv-settings-group">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="iv-card">{children}</div>
    </section>
  );
}

function SettingsForm({ initial }: { initial: Preferences }) {
  const { mutate } = useWorkspace();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      setPending(true);
      try {
        const preferences = Schema.decodeUnknownSync(Preferences)(value);
        const result = await mutate({ action: 'preferences', preferences });
        if (!result.ok) throw new Error('Save failed');
        // The saved values become the new baseline, so the bar goes away.
        formApi.reset(preferences);
        toast('Settings saved');
      } catch {
        toast('Check the dates and numbers, then try again.', 'error');
      } finally {
        setPending(false);
      }
    },
  });
  const dirty = useSelector(form.store, (state) => state.isDirty);
  return (
    <form
      className="iv-page iv-settings"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <header className="iv-page-head">
        <h1>Settings</h1>
      </header>
      <form.Field name="issuer">
        {(issuer) => (
          <>
            <Group
              title="Your business"
              description="The legal identity printed on every new invoice. Issued invoices keep the details they were issued with."
            >
              <PartyFields
                self
                value={issuer.state.value}
                onChange={(party) =>
                  issuer.handleChange({ ...issuer.state.value, ...party })
                }
              />
            </Group>
            <Group
              title="Tax profile"
              description="Decides how IGIC applies. Changes take effect from the date you set."
            >
              <TaxProfileFields
                value={issuer.state.value}
                onChange={(next) => issuer.handleChange(next)}
              />
            </Group>
            <Group
              title="Getting paid"
              description="Printed under payment details, so customers know where to send the money."
            >
              <BankFields
                value={issuer.state.value}
                onChange={(next) => issuer.handleChange(next)}
              />
            </Group>
          </>
        )}
      </form.Field>
      <Group
        title="New invoices"
        description="Defaults for each new draft. You can change them on any draft."
      >
        <div className="iv-grid">
          <form.Field name="language">
            {(language) => (
              <Select
                label="Language"
                value={language.state.value}
                onChange={(next) => language.handleChange(next)}
                options={languages}
              />
            )}
          </form.Field>
          <form.Field name="defaultSeries">
            {(series) => (
              <SeriesField
                value={series.state.value}
                onChange={(next) => series.handleChange(next)}
              />
            )}
          </form.Field>
        </div>
        <form.Field name="defaultTerms">
          {(terms) => (
            <Field
              label="Payment terms"
              multiline
              value={terms.state.value}
              onChange={(next) => terms.handleChange(next)}
            />
          )}
        </form.Field>
        <form.Field name="cover">
          {(cover) => (
            <div className="iv-field">
              <span className="iv-label">Cover</span>
              <CoverPicker
                value={cover.state.value}
                onChange={(next) => cover.handleChange(next)}
              />
            </div>
          )}
        </form.Field>
      </Group>
      <Group
        title="Agents"
        description="Apps you let into your invoices over MCP. Each one acts as you, and disconnecting one shuts it out at once."
      >
        <AgentsSettings />
      </Group>
      <div className="iv-savebar" data-open={dirty} inert={!dirty}>
        <span>Unsaved changes</span>
        <Button variant="ghost" onClick={() => form.reset()}>
          Discard
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          <MorphText>{pending ? 'Saving…' : 'Save'}</MorphText>
        </Button>
      </div>
    </form>
  );
}
