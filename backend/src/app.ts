import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import marketRoutes from './routes/marketRoutes';

const app = express();

app.use(cors({
    exposedHeaders: ['x-admin-key'],
    allowedHeaders: ['Content-Type', 'x-admin-key', 'x-builder-code']
}));
app.use(express.json());

// Routes
app.use('/v1', apiRoutes);
app.use('/v1', marketRoutes);

export default app;
