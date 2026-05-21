import express from 'express';
import * as projectController from './project.controller.js';

const router = express.Router();


// GET /api/users/all-projects
router.get('/all-projects', projectController.allProjects);

// GET /api/projects/process
router.get('/process', projectController.displayData);

export default router;
