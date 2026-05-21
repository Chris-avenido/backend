import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';

export const protect = (req, res, next) => {
  // Placeholder for future JWT verification
  // const token = req.headers.authorization?.split(' ')[1];
  // if (!token) return errorResponse(res, 401, 'Unauthorized');
  
  // Verify token...
  // req.user = decoded;
  
  next();
};
