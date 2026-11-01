import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider, CatalogProvider } from '@hotel/api-client';
import App from './App';
import '@hotel/ui/portal.css';
import '@hotel/ui/workspace.css';
import '@hotel/ui/staff.css';
import './reception.css';

const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter basename={preview ? '/preview' : undefined}>{preview ? <App preview /> : <AuthProvider><CatalogProvider><App /></CatalogProvider></AuthProvider>}</BrowserRouter></StrictMode>);
