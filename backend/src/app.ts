import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import marketRoutes from './routes/marketRoutes';
import claimRoutes from './routes/claimRoutes';

const app = express();

app.use(cors({
    exposedHeaders: ['x-admin-key'],
    allowedHeaders: ['Content-Type', 'x-admin-key', 'x-builder-code', 'x-agent-key', 'x-solana-tx-signature']
}));
app.use(express.json());

// Routes
app.use('/v1', apiRoutes);
app.use('/v1', marketRoutes);
app.use('/v1/claims', claimRoutes);

export default app;
