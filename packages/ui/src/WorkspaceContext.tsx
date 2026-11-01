import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, type PropertyCatalog, type Session } from '@hotel/api-client';
import { createPreviewStore } from './preview';

interface Workspace {
  property: PropertyCatalog;
  user: NonNullable<Session['user']>;
  preview?: boolean;
  request: typeof api;
  refreshAccess: () => void;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<Workspace | null>(null);
export const WorkspaceProvider = WorkspaceContext.Provider;
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('WorkspaceProvider is required.');
  return workspace;
}
export function useStaffRequest() { return useContext(WorkspaceContext)?.request ?? api; }

// Preview is an explicit, isolated route. Its adapter never sends requests to the API.
export function WorkspacePreview({ owner, children }: { owner?: boolean; children: (property: PropertyCatalog) => ReactNode }) {
  const [store] = useState(createPreviewStore);
  return <WorkspaceProvider value={{ property: store.property, user: { id: 'preview-user', fullName: owner ? 'Pramod Owner' : 'Reception Team', email: 'preview@example.test' },
    preview: true, request: store.request, refreshAccess: () => {}, signOut: async () => { window.location.assign('/'); } }}>
    {children(store.property)}
  </WorkspaceProvider>;
}
