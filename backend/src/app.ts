import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/v1', apiRoutes);

export default app;
