import { Schema } from 'effect';

// Each step of an agent's sign-in, carrying on after the owner signs in and
// the owner's answer, comes back from the provider as where the browser goes
// next. The auth client's redirect plugin goes there by itself, so the page
// only waits. It must not navigate too: a second request to the agent's
// callback would carry the same code, and the agent would refuse it.

/** The provider's answer to a step: the next page, or the agent's callback. */
const Redirect = Schema.Struct({
  redirect: Schema.Literal(true),
  url: Schema.String,
});

/** A provider error, as the auth client hands it over: the OAuth error body. */
const Failure = Schema.Struct({
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});

export type Step =
  | { readonly kind: 'leaving' }
  | { readonly kind: 'stopped'; readonly problem: string };

const expired = 'This request has expired. Start again from your agent.';

/** What a step's answer means for the page: wait while the browser leaves, or say why not. */
export function step(answer: { data: unknown; error: unknown }): Step {
  if (Schema.is(Redirect)(answer.data)) return { kind: 'leaving' };
  const failure = Schema.is(Failure)(answer.error) ? answer.error : {};
  // The signed request in the page's address is gone, altered, or past the
  // ten minutes the provider gives it.
  if (
    failure.error === 'invalid_signature' ||
    failure.error_description === 'missing oauth query'
  )
    return { kind: 'stopped', problem: expired };
  return {
    kind: 'stopped',
    problem:
      failure.error_description ??
      failure.message ??
      'The agent could not be connected. Start again from your agent.',
  };
}
