import type { Workspace } from '@portfolio/invoices/store';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import { getWorkspace, type Mutation, mutateWorkspace } from './api';

// Single source of truth: the live collection and useWorkspace share this one
// query key and function, so a single fetch feeds both readers. mutate()
// writes the same cache entry, which keeps every reader in sync.
const workspaceQueryKey = ['invoice-workspace'];

function workspaceQueryOptions() {
  return { queryKey: workspaceQueryKey, queryFn: () => getWorkspace() };
}

// Trivial QueryClient seam: screens never touch the client directly.
function writeWorkspaceCache(client: QueryClient, workspace: Workspace) {
  client.setQueryData(workspaceQueryKey, workspace);
}

function createWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  });
  const options = workspaceQueryOptions();
  const invoices = createCollection(
    queryCollectionOptions({
      queryKey: options.queryKey,
      queryFn: options.queryFn,
      select: (data: Workspace) => [...data.invoices],
      queryClient: client,
      getKey: (invoice) => invoice.id,
    }),
  );
  const customers = createCollection(
    queryCollectionOptions({
      queryKey: options.queryKey,
      queryFn: options.queryFn,
      select: (data: Workspace) => [...data.customers],
      queryClient: client,
      getKey: (customer) => customer.id,
    }),
  );
  const items = createCollection(
    queryCollectionOptions({
      queryKey: options.queryKey,
      queryFn: options.queryFn,
      select: (data: Workspace) => [...data.items],
      queryClient: client,
      getKey: (item) => item.id,
    }),
  );
  async function mutate(data: Mutation) {
    const result = await mutateWorkspace({ data });
    if (result.ok) writeWorkspaceCache(client, result.workspace);
    return result;
  }
  return { client, invoices, customers, items, mutate };
}
const WorkspaceContext = createContext<ReturnType<
  typeof createWorkspace
> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [value] = useState(createWorkspace);
  return (
    <WorkspaceContext.Provider value={value}>
      <QueryClientProvider client={value.client}>
        {children}
      </QueryClientProvider>
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('The invoice workspace is missing.');
  const options = workspaceQueryOptions();
  const query = useQuery({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
  });
  const workspace = useMemo(() => query.data, [query.data]);
  return { ...context, ...query, workspace };
}
