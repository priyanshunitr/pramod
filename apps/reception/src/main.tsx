import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider, CatalogProvider } from '@hotel/api-client';
import App from './App';
import '@hotel/ui/portal.css';
import '@hotel/ui/workspace.css';

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><AuthProvider><CatalogProvider><App /></CatalogProvider></AuthProvider></BrowserRouter></StrictMode>);
