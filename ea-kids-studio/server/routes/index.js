import authRoutes from './auth.js';
import systemRoutes from './system.js';
import projectRoutes from './projects.js';
import libraryRoutes from './library.js';
import productionRoutes from './production.js';
import publishingRoutes from './publishing.js';
import opsRoutes from './ops.js';

export function mountRoutes(app, ctx) {
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/system', systemRoutes(ctx));
  app.use('/api/projects', projectRoutes(ctx));
  app.use('/api', libraryRoutes(ctx));
  app.use('/api', productionRoutes(ctx));
  app.use('/api', publishingRoutes(ctx));
  app.use('/api', opsRoutes(ctx));
}
