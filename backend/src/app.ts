import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import marketRoutes from './routes/marketRoutes';
import claimRoutes from './routes/claimRoutes';
import builderRoutes from './routes/builderRoutes';

const app = express();

app.use(cors({
    exposedHeaders: ['x-admin-key', 'x-admin-secret'],
    allowedHeaders: ['Content-Type', 'x-admin-key', 'x-admin-secret', 'x-builder-code', 'x-agent-key', 'x-solana-tx-signature', 'x-campaign-id']
}));
app.use(express.json());

// Routes
app.use('/v1', apiRoutes);
app.use('/v1', marketRoutes);
app.use('/v1/claims', claimRoutes);
app.use('/v1/builders', builderRoutes);

export default app;
