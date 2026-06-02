import express from 'express';
import * as projectViewController from './project-view.controller.js';

const router = express.Router();

// GET /api/project-view/:projectToken
router.get('/:projectToken', projectViewController.getProjectView);

export default router;
