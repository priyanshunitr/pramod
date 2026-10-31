import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { pool } from './db/pool.js';
import { getPropertyCatalog, type PropertyCatalog } from './modules/catalog/catalog.repository.js';
import { allowedOrigins, HttpError, protectWrites } from './lib/http.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { customerBookingRouter, propertyBookingRouter } from './modules/bookings/bookings.routes.js';

interface Dependencies {
  checkDatabase: () => Promise<void>;
  getCatalog: (slug: string) => Promise<PropertyCatalog | null>;
}

export function createApp(dependencies: Dependencies = {
  checkDatabase: async () => { await pool.query('SELECT 1'); },
  getCatalog: getPropertyCatalog,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: [...allowedOrigins], credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', protectWrites);
  app.use('/api/auth', authRouter);
  app.use('/api/properties/:propertyId/staff', staffRouter);
  app.use('/api/properties/:propertyId', propertyBookingRouter);
  app.use('/api/bookings', customerBookingRouter);

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'hotel-api' });
  });

  app.get('/api/ready', async (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      await dependencies.checkDatabase();
      response.json({ status: 'ok', database: 'connected' });
    } catch {
      response.status(503).json({ status: 'unavailable', database: 'disconnected' });
    }
  });

  app.get('/api/properties/:slug', async (request, response) => {
    if (!/^[a-z0-9-]{1,80}$/.test(request.params.slug)) {
      response.status(400).json({ error: 'Invalid property slug.' });
      return;
    }
    const property = await dependencies.getCatalog(request.params.slug);
    if (!property) {
      response.status(404).json({ error: 'Property not found.' });
      return;
    }
    response.json({ data: property });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof HttpError) {
      if (error.status === 429) response.setHeader('Retry-After', '900');
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error?.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
    if (error?.type === 'entity.too.large') {
      response.status(413).json({ error: 'Request body is too large.' });
      return;
    }
    console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
    response.status(500).json({ error: 'An unexpected server error occurred.' });
  };
  app.use(errorHandler);
  return app;
}
