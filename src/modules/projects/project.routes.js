import express from 'express';
import * as projectController from './project.controller.js';

const router = express.Router();


// GET /api/users/all-projects
router.get('/all-projects', projectController.allProjects);

// GET /api/projects/process
router.get('/process', projectController.displayData);

// GET /api/projects/:projectId/tranches
router.get('/:projectId/tranches', projectController.getTrancheFund);

// PUT /api/projects/:projectId/tranches
router.put('/:projectId/tranches', projectController.saveTrancheFund);

export default router;
