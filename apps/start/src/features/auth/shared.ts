// Settings both the server and the browser read.

/** Where better-auth answers. It sits under /invoices, so the Start app owns it next to the pages it serves. */
export const authBasePath = '/invoices/auth';

/** Signs the owner in without typing. Authorization never reads it; the owner's DID decides. */
export const ownerHandle = 'hadronomy.com';

/** The PostgreSQL schema the auth tables live in, beside the invoices'. */
export const authNamespace = 'auth';

/** The scope an agent asks for: everything the owner can do in the workspace. */
export const agentScope = 'invoices';

/** The MCP endpoint, as the resource agents' tokens are bound to. */
export const agentResource = (origin: string) => `${origin}/invoices/mcp`;

/** Who issues agents' tokens: this sign-in, at its own path. */
export const agentIssuer = (origin: string) => `${origin}${authBasePath}`;

/** How long a customer's sign-in code works, in seconds. Its email states it too. */
export const codeLifetime = 600;
