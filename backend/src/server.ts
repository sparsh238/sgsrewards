import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import itemRoutes from './routes/itemRoutes'
import billRoutes from './routes/billRoutes'
import errorHandler from './utils/errorHandler';

dotenv.config();

const app = express();

// Security headers. crossOriginResourcePolicy is relaxed so the SPA (a
// different origin) can still load images served from /uploads.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS allowlist. Set CORS_ORIGINS to a comma-separated list of allowed
// origins in production (e.g. "https://app.example.com"). If unset, all
// origins are allowed for backwards compatibility, with a startup warning.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn('[security] CORS_ORIGINS not set — allowing all origins. Set it in production.');
  app.use(cors());
} else {
  app.use(cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header) and allowlisted origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  }));
}

app.use('/uploads', express.static('uploads'));
app.use(express.json({ limit: '1mb' }));

// Throttle authentication endpoints to blunt brute-force / credential-stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // per IP, per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/item', itemRoutes);
app.use('/api/bill', billRoutes);

app.use(errorHandler);

const connectDB = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI!);
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('Database connection error:', error);
      process.exit(1);
    }
  };
  
  connectDB().then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  });
