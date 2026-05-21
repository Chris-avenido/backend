import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import userRoutes from './modules/users/user.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import db from './config/db.js';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Base route to prevent 404 on root
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the DepEd Finance Portal API',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      projects: '/api/projects'
    }
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);

// Basic health check route
app.get('/api/health', async (req, res) => {
  try {
    await db.raw('SELECT 1+1 AS result');
    res.status(200).json({ 
      status: 'healthy', 
      message: 'Finance Backend API is running',
      database: 'connected'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to connect to the database' 
    });
  }
});

export default app;
