import type { Issuer, Party } from '@portfolio/invoices/model';
import { AddressFields } from './address-fields';
import { activities, censusStates, legalForms, regimes } from './choices';
import { checkIban, ownDomain } from './identity';
import {
  AmountField,
  BicField,
  EmailField,
  IbanField,
  TaxIdField,
  WebsiteField,
} from './smart-fields';
import { Field, Select } from './ui';

/**
 * A legal identity. `self` marks the owner's own details, the only place the
 * browser may offer autofill: for a customer it would suggest the owner's
 * address.
 */
export function PartyFields({
  value,
  onChange,
  disabled = false,
  self = false,
}: {
  value: Party;
  onChange: (value: Party) => void;
  disabled?: boolean;
  self?: boolean;
}) {
  const set =
    <K extends keyof Party>(key: K) =>
    (next: Party[K]) =>
      onChange({ ...value, [key]: next });
  return (
    <>
      <div className="iv-grid">
        <Field
          className="iv-span"
          label="Legal name"
          value={value.name}
          disabled={disabled}
          onChange={set('name')}
          input={{ autoComplete: self ? 'organization' : 'off' }}
        />
        <TaxIdField
          value={value.taxId}
          country={value.address.country}
          disabled={disabled}
          onChange={set('taxId')}
        />
        <EmailField
          value={value.email}
          disabled={disabled}
          self={self}
          onChange={set('email')}
        />
      </div>
      <AddressFields
        value={value.address}
        disabled={disabled}
        self={self}
        onChange={set('address')}
      />
    </>
  );
}

type IssuerProps = {
  value: Issuer;
  onChange: (value: Issuer) => void;
};

function useSet({ value, onChange }: IssuerProps) {
  return <K extends keyof Issuer>(key: K, next: Issuer[K]) =>
    onChange({ ...value, [key]: next });
}

export function TaxProfileFields(props: IssuerProps) {
  const { value } = props;
  const set = useSet(props);
  return (
    <>
      <div className="iv-grid">
        <Select
          label="Legal form"
          value={value.legalForm}
          onChange={(next) => set('legalForm', next)}
          options={legalForms}
        />
        <Select
          label="IGIC regime"
          value={value.regime}
          onChange={(next) => set('regime', next)}
          options={regimes}
        />
        <Select
          label="Activity"
          value={value.activity}
          onChange={(next) => set('activity', next)}
          options={activities}
        />
        <Field
          label="Profile effective from"
          type="date"
          value={value.effectiveFrom}
          onChange={(next) => set('effectiveFrom', next)}
        />
        <Field
          label="Professional start year"
          numeric
          placeholder={String(new Date().getFullYear())}
          input={{ inputMode: 'numeric', maxLength: 4 }}
          value={value.professionalStartYear?.toString() ?? ''}
          onChange={(next) => {
            const digits = next.replace(/\D/g, '').slice(0, 4);
            set('professionalStartYear', digits ? Number(digits) : null);
          }}
        />
      </div>
      <label className="iv-check">
        <input
          type="checkbox"
          checked={value.canaryEstablished}
          onChange={(event) => set('canaryEstablished', event.target.checked)}
        />
        <span>Established in the Canary Islands</span>
      </label>
      {value.regime === 'repep' && (
        <>
          <div className="iv-grid">
            <Select
              label="REPEP census status"
              value={value.repepCensus}
              onChange={(next) => set('repepCensus', next)}
              options={censusStates}
            />
            <Field
              label="Census declaration reference"
              value={value.repepReference}
              onChange={(next) => set('repepReference', next)}
            />
            <Field
              label="Previous turnover year"
              numeric
              input={{ inputMode: 'numeric', maxLength: 4 }}
              value={String(value.repepTurnoverYear)}
              onChange={(next) =>
                set(
                  'repepTurnoverYear',
                  Number(next.replace(/\D/g, '').slice(0, 4)),
                )
              }
            />
            <AmountField
              label="Previous annual turnover"
              unit="€"
              step={1000}
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
          <label className="iv-check">
            <input
              type="checkbox"
              checked={value.repepTransition}
              onChange={(event) => set('repepTransition', event.target.checked)}
            />
            <span>Elected the July 2026 transition</span>
          </label>
        </>
      )}
    </>
  );
}

/**
 * Where the owner gets paid. A Spanish IBAN names its bank, so the bank name
 * and BIC are offered as ghosts in their own fields, one Tab each, rather
 * than written in behind the owner's back.
 */
export function BankFields(props: IssuerProps) {
  const { value } = props;
  const set = useSet(props);
  const check = checkIban(value.iban);
  const bank = check.kind === 'valid' ? check.bank : null;
  return (
    <div className="iv-grid">
      <IbanField
        className="iv-span"
        value={value.iban}
        onChange={(next) => set('iban', next)}
      />
      <Field
        label="Bank name"
        value={value.bankName}
        suggest={bank?.name}
        onChange={(next) => set('bankName', next)}
      />
      <BicField
        value={value.bic}
        bank={bank?.bic}
        onChange={(next) => set('bic', next)}
      />
      <WebsiteField
        className="iv-span"
        value={value.website}
        domain={ownDomain(value.email) ?? undefined}
        onChange={(next) => set('website', next)}
      />
    </div>
  );
}
