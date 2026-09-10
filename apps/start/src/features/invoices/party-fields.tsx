import type { Issuer, Party } from '@portfolio/invoices/model';
import { Check, Field, Select } from './ui';

export function PartyFields({
  value,
  onChange,
  disabled = false,
}: {
  value: Party;
  onChange: (value: Party) => void;
  disabled?: boolean;
}) {
  return (
    <div className="iv-form-grid">
      {(
        [
          ['name', 'Legal name'],
          ['taxId', 'Tax ID / NIF'],
          ['address', 'Address'],
          ['postalCode', 'Postal code'],
          ['city', 'City'],
          ['country', 'Country code'],
          ['email', 'Email'],
        ] as const
      ).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={value[key]}
          disabled={disabled}
          onChange={(text) => onChange({ ...value, [key]: text })}
        />
      ))}
    </div>
  );
}

export function IssuerFields({
  value,
  onChange,
}: {
  value: Issuer;
  onChange: (value: Issuer) => void;
}) {
  const set = <K extends keyof Issuer>(key: K, next: Issuer[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <h3>Legal identity</h3>
      <PartyFields
        value={value}
        onChange={(party) => onChange({ ...value, ...party })}
      />
      <h3>Tax profile</h3>
      <div className="iv-form-grid">
        <Select
          label="Legal form"
          value={value.legalForm}
          onChange={(next) => set('legalForm', next)}
          options={[
            ['sole-trader', 'Sole trader'],
            ['company', 'Company'],
          ]}
        />
        <Select
          label="IGIC regime"
          value={value.regime}
          onChange={(next) => set('regime', next)}
          options={[
            ['ordinary', 'Ordinary IGIC'],
            ['repep', 'REPEP exemption'],
          ]}
        />
        <Select
          label="Activity"
          value={value.activity}
          onChange={(next) => set('activity', next)}
          options={[
            ['professional', 'Professional'],
            ['business', 'Business'],
          ]}
        />
        <Field
          label="Profile effective from"
          type="date"
          value={value.effectiveFrom}
          onChange={(next) => set('effectiveFrom', next)}
        />
        <Field
          label="Professional start year"
          type="number"
          value={value.professionalStartYear?.toString() ?? ''}
          onChange={(next) =>
            set('professionalStartYear', next ? Number(next) : null)
          }
        />
      </div>
      <Check
        label="Established in the Canary Islands"
        checked={value.canaryEstablished}
        onChange={(next) => set('canaryEstablished', next)}
      />
      {value.regime === 'repep' && (
        <div className="iv-tax-profile">
          <div className="iv-form-grid">
            <Select
              label="REPEP census status"
              value={value.repepCensus}
              onChange={(next) => set('repepCensus', next)}
              options={[
                ['not-included', 'Not included'],
                ['included', 'Included'],
              ]}
            />
            <Field
              label="Census declaration reference"
              value={value.repepReference}
              onChange={(next) => set('repepReference', next)}
            />
            <Field
              label="Previous turnover year"
              type="number"
              value={String(value.repepTurnoverYear)}
              onChange={(next) => set('repepTurnoverYear', Number(next))}
            />
            <Field
              label="Previous annual turnover (€)"
              value={value.repepTurnover}
              onChange={(next) => set('repepTurnover', next)}
            />
            <Field
              label="Exemption end date (optional)"
              type="date"
              value={value.repepUntil ?? ''}
              onChange={(next) => set('repepUntil', next || null)}
            />
          </div>
          <Check
            label="Elected the July 2026 transition"
            checked={value.repepTransition}
            onChange={(next) => set('repepTransition', next)}
          />
        </div>
      )}
      <h3>Bank details</h3>
      <div className="iv-form-grid">
        {(
          [
            ['iban', 'IBAN'],
            ['bankName', 'Bank name'],
            ['bic', 'BIC / SWIFT'],
            ['website', 'Website'],
          ] as const
        ).map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={value[key]}
            onChange={(next) => set(key, next)}
          />
        ))}
      </div>
    </>
  );
}
