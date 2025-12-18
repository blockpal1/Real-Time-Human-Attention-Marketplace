import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import marketRoutes from './routes/marketRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/v1', apiRoutes);
app.use('/v1', marketRoutes);

export default app;
