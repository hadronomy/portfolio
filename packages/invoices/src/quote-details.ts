import { Schema } from 'effect';
import {
  type Address,
  addressLabels,
  postalCodeValid,
  regionOfPostalCode,
  regionsOf,
  requiredFields,
} from '#address';
import { countryOf, fold } from '#countries';
import { Customer, Invoice, Party } from '#model';
import { EmailAddress } from '#quote-model';
import { checkTaxId, compactTaxId } from '#tax-id';

/** The identity the customer confirms before reading and answering a quote. */
export const CustomerDetails = Schema.Struct({
  customer: Party,
  customerType: Customer.fields.type,
});
export interface CustomerDetails
  extends Schema.Schema.Type<typeof CustomerDetails> {}

export const DetailsField = Schema.Literals([
  'name',
  'taxId',
  'email',
  'address.lines',
  'address.dependentLocality',
  'address.postalCode',
  'address.locality',
  'address.region',
  'address.sortingCode',
  'address.country',
  'customerType',
]);
export type DetailsField = typeof DetailsField.Type;

/** Stable field codes let both the server and customer form use the same rules. */
export const DetailsIssue = Schema.Struct({
  field: DetailsField,
  reason: Schema.Literals([
    'required',
    'tax-id',
    'email',
    'postal-code',
    'region',
    'postal-region',
  ]),
});
export type DetailsIssue = typeof DetailsIssue.Type;

export class InvalidDetails extends Schema.TaggedError<InvalidDetails>()(
  'InvalidDetails',
  { issues: Schema.Array(DetailsIssue) },
) {}

export const DetailsChange = Schema.Struct({
  field: DetailsField,
  before: Schema.String,
  after: Schema.String,
});

export const DetailsReason = Schema.Literals([
  'territory',
  'customer-type',
  'territory-and-type',
]);

const confirmedFields = {
  confirmedAt: Schema.String,
  changes: Schema.Array(DetailsChange),
  territory: Customer.fields.territory,
  customerType: Customer.fields.type,
};
/** Public confirmation state. Request evidence stays in the private audit log. */
export const DetailsState = Schema.Union([
  Schema.Struct({ state: Schema.Literal('waiting') }),
  Schema.Struct({ state: Schema.Literal('confirmed'), ...confirmedFields }),
  Schema.Struct({
    state: Schema.Literal('needs-revision'),
    ...confirmedFields,
    reason: DetailsReason,
  }),
]);
export type DetailsState = typeof DetailsState.Type;

/** Each confirmation preserves its previous revision and the owner's original tax basis. */
export const DetailsConfirmation = Schema.Struct({
  ...confirmedFields,
  reason: Schema.NullOr(DetailsReason),
  before: Invoice,
  original: Invoice,
  revision: Schema.Number,
  address: Schema.String,
  agent: Schema.String,
});
export type DetailsConfirmation = typeof DetailsConfirmation.Type;

export const detailsState = (
  confirmation: DetailsConfirmation | null,
): DetailsState =>
  !confirmation
    ? { state: 'waiting' }
    : confirmation.reason
      ? {
          state: 'needs-revision',
          confirmedAt: confirmation.confirmedAt,
          changes: confirmation.changes,
          territory: confirmation.territory,
          customerType: confirmation.customerType,
          reason: confirmation.reason,
        }
      : {
          state: 'confirmed',
          confirmedAt: confirmation.confirmedAt,
          changes: confirmation.changes,
          territory: confirmation.territory,
          customerType: confirmation.customerType,
        };

/** Country metadata and Spanish provinces determine the directory territory. */
export function territoryOf(
  address: Address,
): typeof Customer.fields.territory.Type {
  if (address.country !== 'ES')
    return countryOf(address.country)?.eu ? 'eu' : 'other';
  const region = fold(address.region);
  return ['las palmas', 'santa cruz de tenerife'].includes(region)
    ? 'canary-islands'
    : 'mainland-spain';
}

/** Normalize confirmed data once, before validation and storage. */
export function tidyDetails(details: CustomerDetails): CustomerDetails {
  const address = Object.fromEntries(
    Object.entries(details.customer.address).map(([key, value]) => [
      key,
      value.trim(),
    ]),
  ) as unknown as Address;
  const regions = regionsOf(address.country);
  const region = regions.find((item) =>
    [item.name, item.other].some(
      (name) => name && fold(name) === fold(address.region),
    ),
  );
  return {
    customerType: details.customerType,
    customer: {
      name: details.customer.name.trim(),
      taxId: compactTaxId(details.customer.taxId),
      email: details.customer.email.trim().toLowerCase(),
      address: {
        ...address,
        postalCode: address.postalCode.toUpperCase(),
        region: region?.name ?? address.region,
      },
    },
  };
}

/** Required country fields, tax controls, and email rules shared with the customer form. */
export function detailsIssues(details: CustomerDetails): DetailsIssue[] {
  const issues: DetailsIssue[] = [];
  const { customer } = details;
  const { address } = customer;
  if (!customer.name.trim()) issues.push({ field: 'name', reason: 'required' });
  const tax = checkTaxId(customer.taxId, address.country);
  if (tax.kind === 'empty') issues.push({ field: 'taxId', reason: 'required' });
  else if (tax.kind === 'invalid')
    issues.push({ field: 'taxId', reason: 'tax-id' });
  if (!customer.email.trim())
    issues.push({ field: 'email', reason: 'required' });
  else if (!Schema.is(EmailAddress)(customer.email.trim()))
    issues.push({ field: 'email', reason: 'email' });
  for (const field of requiredFields(address.country))
    if (!address[field].trim())
      issues.push({ field: `address.${field}`, reason: 'required' });
  if (
    address.postalCode &&
    !postalCodeValid(address.country, address.postalCode)
  )
    issues.push({ field: 'address.postalCode', reason: 'postal-code' });
  const regions = regionsOf(address.country);
  if (
    address.region &&
    regions.length &&
    !regions.some((region) =>
      [region.name, region.other].some(
        (name) => name && fold(name) === fold(address.region),
      ),
    )
  )
    issues.push({ field: 'address.region', reason: 'region' });
  const inferred = regionOfPostalCode(address.country, address.postalCode);
  if (
    address.region &&
    inferred &&
    fold(inferred.name) !== fold(address.region)
  )
    issues.push({ field: 'address.region', reason: 'postal-region' });
  return issues;
}

/** Differences from the owner's original quote, including fields that were empty. */
export function detailsChanges(
  original: Invoice,
  details: CustomerDetails,
): (typeof DetailsChange.Type)[] {
  const before = original.data.customer;
  return DetailsField.literals.flatMap((field) => {
    const value = (customer: typeof before) =>
      field.startsWith('address.')
        ? customer.address[field.slice(8) as keyof Address]
        : customer[field as 'name' | 'taxId' | 'email'];
    const left =
      field === 'customerType' ? original.data.customerType : value(before);
    const right =
      field === 'customerType' ? details.customerType : value(details.customer);
    return left === right ? [] : [{ field, before: left, after: right }];
  });
}

/** Country-specific label keys consumed by translated messages in the UI. */
export function detailsLabel(
  field: DetailsField,
  country: Address['country'],
): string {
  return field.startsWith('address.')
    ? addressLabels(country)[
        field.slice(8) as keyof ReturnType<typeof addressLabels>
      ]
    : field;
}
