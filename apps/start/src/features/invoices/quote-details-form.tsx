import { m } from '@portfolio/i18n/messages';
import {
  type Address,
  type AddressField,
  addressLayout,
  numericPostalCode,
  postalExample,
  regionOfPostalCode,
  regionsOf,
  requiredFields,
} from '@portfolio/invoices/address';
import { countries } from '@portfolio/invoices/countries';
import type { Invoice } from '@portfolio/invoices/model';
import {
  type CustomerDetails,
  type DetailsField,
  type DetailsIssue,
  detailsIssues,
  detailsLabel,
  tidyDetails,
} from '@portfolio/invoices/quote-details';
import { useRouter } from '@tanstack/react-router';
import { type InputHTMLAttributes, useId, useMemo, useState } from 'react';
import { useT } from '../../lib/i18n';
import { CollectionNotice } from '../privacy/collection-notice';
import { confirmQuoteLinkDetails } from './api';
import { coverArt } from './covers';
import { Button, MorphText } from './ui';

function DetailsInput({
  label,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="iv-details-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        className={`iv-input${input.name === 'taxId' || input.name === 'address.postalCode' ? ' iv-num' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="iv-details-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** The quote stays behind this form until the customer confirms valid details. */
export function QuoteDetailsForm({
  quote,
  token,
  onConfirmed,
  onCancel,
}: {
  quote: Invoice;
  token: string;
  onConfirmed: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [details, setDetails] = useState<CustomerDetails>(() => ({
    customer: quote.data.customer,
    customerType: quote.data.customerType,
  }));
  const [touched, setTouched] = useState<
    Partial<Record<DetailsField, boolean>>
  >({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverIssues, setServerIssues] = useState<DetailsIssue[]>([]);
  const [problem, setProblem] = useState<'closed' | 'failed' | null>(null);
  const countryId = useId();
  const regionList = useId();
  const { customer, customerType } = details;
  const { address } = customer;
  const country = address.country;
  const required = requiredFields(country);
  const countryOptions = useMemo(() => {
    const names = new Intl.DisplayNames([t.locale], { type: 'region' });
    return countries
      .map(({ code }) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, t.locale))
      .map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ));
  }, [t.locale]);
  const issues = [...detailsIssues(tidyDetails(details)), ...serverIssues];
  const words = {
    required: m.quote_details_required,
    'tax-id': m.quote_details_invalid_tax,
    email: m.quote_details_invalid_email,
    'postal-code': m.quote_details_invalid_postal,
    region: m.quote_details_invalid_region,
    'postal-region': m.quote_details_postal_region,
  };
  const error = (field: DetailsField) => {
    const issue = issues.find((item) => item.field === field);
    return issue && (submitted || touched[field])
      ? t(words[issue.reason])
      : undefined;
  };
  const touch = (field: DetailsField) =>
    setTouched((current) => ({ ...current, [field]: true }));
  const update = (next: CustomerDetails) => {
    setDetails(next);
    setServerIssues([]);
    setProblem(null);
  };
  const set = (field: 'name' | 'taxId' | 'email', value: string) =>
    update({ ...details, customer: { ...customer, [field]: value } });
  const setAddress = (field: AddressField, value: string) => {
    const next = { ...address, [field]: value };
    if (field === 'postalCode') {
      const region = regionOfPostalCode(country, value);
      if (region) next.region = region.name;
    }
    update({ ...details, customer: { ...customer, address: next } });
  };
  const autos: Partial<Record<AddressField, string>> = {
    lines: 'address-line1',
    postalCode: 'postal-code',
    locality: 'address-level2',
    region: 'address-level1',
    dependentLocality: 'address-level3',
  };
  const label = (field: AddressField) =>
    t(m.quote_details_address_label, {
      label: detailsLabel(`address.${field}`, country),
    });
  const renderField = (field: AddressField) => {
    const [street = '', ...extra] = address.lines.split('\n');
    return (
      <div
        key={field}
        className={field === 'lines' ? 'iv-details-street' : undefined}
      >
        <DetailsInput
          name={`address.${field}`}
          label={label(field)}
          value={field === 'lines' ? street : address[field]}
          required={required.has(field)}
          autoComplete={autos[field]}
          maxLength={field === 'lines' ? 300 : 150}
          inputMode={
            field === 'postalCode' && numericPostalCode(country)
              ? 'numeric'
              : 'text'
          }
          placeholder={
            field === 'postalCode' ? postalExample(country) : undefined
          }
          list={field === 'region' ? regionList : undefined}
          error={error(`address.${field}`)}
          onBlur={() => touch(`address.${field}`)}
          onChange={(event) =>
            setAddress(
              field,
              field === 'lines'
                ? [event.target.value, ...extra].join('\n')
                : event.target.value,
            )
          }
        />
        {field === 'lines' && (
          <DetailsInput
            name="address.extra"
            label={t(m.quote_details_extra)}
            autoComplete="address-line2"
            value={extra.join('\n')}
            maxLength={300}
            onChange={(event) =>
              setAddress(
                'lines',
                [street, event.target.value]
                  .filter((value, index) => index === 0 || value)
                  .join('\n'),
              )
            }
          />
        )}
      </div>
    );
  };
  const save = async (form: HTMLFormElement) => {
    const normalized = tidyDetails(details);
    setSubmitted(true);
    const invalid = detailsIssues(normalized);
    if (invalid.length) {
      form.querySelector<HTMLElement>(`[name="${invalid[0]?.field}"]`)?.focus();
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const result = await confirmQuoteLinkDetails({
        data: { token, details: normalized },
      });
      if (!result.ok) {
        if (result.reason === 'invalid-details')
          setServerIssues([...result.issues]);
        else setProblem('closed');
        return;
      }
      await router.invalidate();
      onConfirmed();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      setProblem('failed');
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="iv iv-signin iv-quote-details" lang={t.locale}>
      <div className="iv-backdrop" aria-hidden>
        <img
          src={
            coverArt[quote.data.cover === 'none' ? 'ember' : quote.data.cover]
              .backdrop
          }
          alt=""
          data-active="true"
        />
      </div>
      <main className="iv-signin-card iv-details-card">
        <header>
          <p>
            {quote.data.issuer.name} ·{' '}
            <span className="iv-num">{quote.number}</span>
          </p>
          <h1>{t(m.quote_details_title)}</h1>
        </header>
        <p>{t(m.quote_details_intro, { issuer: quote.data.issuer.name })}</p>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) void save(event.currentTarget);
          }}
        >
          <fieldset disabled={pending} className="iv-details-fields">
            <DetailsInput
              name="name"
              label={t(m.quote_details_name)}
              value={customer.name}
              autoComplete={
                customerType === 'business' ? 'organization' : 'name'
              }
              required
              maxLength={200}
              error={error('name')}
              onBlur={() => touch('name')}
              onChange={(event) => set('name', event.target.value)}
            />
            <DetailsInput
              name="taxId"
              label={t(m.quote_details_tax_id)}
              value={customer.taxId}
              required
              maxLength={50}
              autoCapitalize="characters"
              spellCheck={false}
              error={error('taxId')}
              onBlur={() => touch('taxId')}
              onChange={(event) => set('taxId', event.target.value)}
            />
            <DetailsInput
              name="email"
              label={t(m.quote_details_email)}
              value={customer.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              error={error('email')}
              onBlur={() => touch('email')}
              onChange={(event) => set('email', event.target.value)}
            />
            <div className="iv-details-field">
              <label htmlFor={countryId}>{t(m.quote_details_country)}</label>
              <select
                id={countryId}
                name="address.country"
                className="iv-input"
                autoComplete="country"
                value={country}
                onChange={(event) =>
                  update({
                    ...details,
                    customer: {
                      ...customer,
                      address: {
                        ...address,
                        country: event.target.value as Address['country'],
                        region: '',
                      },
                    },
                  })
                }
              >
                {countryOptions}
              </select>
            </div>
            {addressLayout(country).map((row) => (
              <div
                key={row.join('-')}
                className="iv-details-row"
                data-paired={row.length > 1 || undefined}
              >
                {row.map(renderField)}
              </div>
            ))}
            <datalist id={regionList}>
              {regionsOf(country).map((region) => (
                <option key={region.name} value={region.name} />
              ))}
            </datalist>
            <fieldset className="iv-details-type">
              <legend>{t(m.quote_details_type)}</legend>
              {(['business', 'consumer'] as const).map((type) => (
                <label key={type} className="iv-check">
                  <input
                    type="radio"
                    name="customerType"
                    checked={customerType === type}
                    value={type}
                    onChange={() => update({ ...details, customerType: type })}
                  />
                  <span>
                    {t(
                      type === 'business'
                        ? m.quote_details_business
                        : m.quote_details_consumer,
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          </fieldset>
          {problem && (
            <p className="iv-details-error" role="alert">
              {t(
                problem === 'closed'
                  ? m.quote_details_closed
                  : m.quote_details_failed,
              )}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            <MorphText>
              {t(pending ? m.quote_details_saving : m.quote_details_continue)}
            </MorphText>
          </Button>
          {onCancel && (
            <Button variant="ghost" disabled={pending} onClick={onCancel}>
              {t(m.quote_back)}
            </Button>
          )}
          <CollectionNotice
            purpose="quote-details"
            controller={quote.data.issuer.name}
          />
        </form>
      </main>
    </div>
  );
}
