import express from 'express';
import * as userController from './user.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/users
router.get('/', userController.getUsers);

// GET /api/users/:uid
router.get('/:uid', userController.userInfo);

// POST /api/users/login
router.post('/login', userController.login);

// POST /api/users/register
router.post('/register', userController.register);

// PUT /api/users/:uid
router.put('/:uid', userController.updateUser);

// POST /api/users/:uid/verify-passcode
router.post('/:uid/verify-passcode', userController.verifyPasscode);

// POST /api/users/forgot-password
router.post('/forgot-password', userController.forgotPassword);

// POST /api/users/reset-password
router.post('/reset-password', userController.resetPassword);

export default router;
