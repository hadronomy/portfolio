import { newInvoice } from '@portfolio/invoices/model';
import type { Workspace } from '@portfolio/invoices/store';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';
import {
  getWorkspace,
  type Mutation,
  mutateWorkspace,
} from '~/features/invoices/api';
import { invoiceQueries } from '~/features/invoices/queries';

// The live collections and useWorkspace read one query: a single fetch
// feeds every reader, and mutate() writes that same cache entry, which keeps
// them all in sync. The client is the router's, so what the route's loader
// fetched is already here.
function createWorkspace(client: QueryClient) {
  const workspace = invoiceQueries.workspace();
  // Each collection names the factory's key but its own query function:
  // queryCollectionOptions infers row types from a plain function, and the
  // factory's tagged one would erase them. Both call getWorkspace.
  const invoices = createCollection(
    queryCollectionOptions({
      queryKey: workspace.queryKey,
      queryFn: () => getWorkspace(),
      select: (data: Workspace) => [...data.invoices],
      queryClient: client,
      getKey: (invoice) => invoice.id,
    }),
  );
  const customers = createCollection(
    queryCollectionOptions({
      queryKey: workspace.queryKey,
      queryFn: () => getWorkspace(),
      select: (data: Workspace) => [...data.customers],
      queryClient: client,
      getKey: (customer) => customer.id,
    }),
  );
  const items = createCollection(
    queryCollectionOptions({
      queryKey: workspace.queryKey,
      queryFn: () => getWorkspace(),
      select: (data: Workspace) => [...data.items],
      queryClient: client,
      getKey: (item) => item.id,
    }),
  );
  async function mutate(data: Mutation) {
    const result = await mutateWorkspace({ data });
    if (result.ok) client.setQueryData(workspace.queryKey, result.workspace);
    return result;
  }
  return { client, invoices, customers, items, mutate };
}
const WorkspaceContext = createContext<ReturnType<
  typeof createWorkspace
> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [value] = useState(() => createWorkspace(client));
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('The invoice workspace is missing.');
  const query = useQuery(invoiceQueries.workspace());
  return { ...context, ...query, workspace: query.data };
}

/** Saves a fresh draft from the owner's defaults and opens it. Resolves false when the save fails. */
export function useCreateInvoice() {
  const { workspace, mutate } = useWorkspace();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const create = useCallback(async () => {
    if (!workspace) return false;
    setPending(true);
    try {
      const invoice = newInvoice(workspace.preferences);
      const result = await mutate({ action: 'save', invoice });
      if (!result.ok) return false;
      await navigate({
        to: '/invoices/$invoiceId',
        params: { invoiceId: invoice.id },
      });
      return true;
    } catch {
      return false;
    } finally {
      setPending(false);
    }
  }, [workspace, mutate, navigate]);
  return { create, pending, ready: !!workspace };
}
