export const propertySlug = import.meta.env.VITE_PROPERTY_SLUG || 'demo-hotel';
export function frontendUrl(app: 'guest' | 'reception' | 'owner') {
  const configured = { guest: import.meta.env.VITE_GUEST_URL, reception: import.meta.env.VITE_RECEPTION_URL, owner: import.meta.env.VITE_OWNER_URL }[app];
  if (configured) return configured as string;
  const hostname = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname;
  if (import.meta.env.DEV || ['127.0.0.1', 'localhost'].includes(hostname)) {
    return `http://${hostname}:${{ guest: 5173, reception: 5174, owner: 5175 }[app]}`;
  }
  // Production apps must configure their public URLs. Avoid sending visitors to localhost.
  return `/${app}/`;
}
