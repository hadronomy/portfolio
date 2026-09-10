import { Preferences } from '@portfolio/invoices/model';
import { useForm } from '@tanstack/react-form';
import { Schema } from 'effect';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { IssuerFields } from './party-fields';
import { Field, Morph, Select } from './ui';
import { useWorkspace } from './workspace';

export function Settings() {
  const { workspace, isError } = useWorkspace();
  if (!workspace)
    return (
      <div className="iv-preview-message">
        {isError ? 'Settings could not load.' : 'Loading settings…'}
      </div>
    );
  return <SettingsForm initial={workspace.preferences} />;
}

function SettingsForm({ initial }: { initial: Preferences }) {
  const { mutate } = useWorkspace();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      setPending(true);
      setStatus('');
      try {
        const preferences = Schema.decodeUnknownSync(Preferences)(value);
        const result = await mutate({ action: 'preferences', preferences });
        setStatus(
          result.ok ? 'Settings saved' : 'Settings could not be saved.',
        );
      } catch {
        setStatus('Check the dates and numeric values, then try again.');
      } finally {
        setPending(false);
      }
    },
  });
  return (
    <>
      <header className="iv-topbar">
        <div className="iv-breadcrumb">
          Workspace<span>/</span>Settings
        </div>
        <span className="iv-account">hadronomy.com</span>
      </header>
      <form
        className="iv-settings"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <h1>Your business</h1>
        <p>
          Set the details used in new invoices. Issued invoices keep their
          original legal record.
        </p>
        <div className="iv-settings-section">
          <form.Field
            name="issuer"
            children={(issuer) => (
              <IssuerFields
                value={issuer.state.value}
                onChange={(next) => issuer.handleChange(next)}
              />
            )}
          />
        </div>
        <div className="iv-settings-section">
          <h3>Document defaults</h3>
          <div className="iv-form-grid">
            <form.Field
              name="language"
              children={(language) => (
                <Select
                  label="Default language"
                  value={language.state.value}
                  onChange={(next) => language.handleChange(next)}
                  options={[
                    ['en', 'English'],
                    ['es', 'Español'],
                  ]}
                />
              )}
            />
            <form.Field
              name="defaultSeries"
              children={(series) => (
                <Field
                  label="Default numbering series"
                  value={series.state.value}
                  onChange={(next) => series.handleChange(next)}
                />
              )}
            />
          </div>
          <form.Field
            name="defaultTerms"
            children={(terms) => (
              <Field
                label="Default payment terms"
                multiline
                value={terms.state.value}
                onChange={(next) => terms.handleChange(next)}
              />
            )}
          />
        </div>
        <div className="iv-settings-actions">
          <button type="submit" className="iv-primary" disabled={pending}>
            <Save size={15} />
            {pending ? 'Saving…' : 'Save settings'}
          </button>
          <output>
            <Morph>{status}</Morph>
          </output>
        </div>
      </form>
    </>
  );
}
