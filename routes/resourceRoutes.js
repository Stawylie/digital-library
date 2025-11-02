const express = require('express');
const router = express.Router();
// Use correct case for cross-platform compatibility (Windows vs. Linux/Mac filesystems)
const resourceController = require('../Controllers/resourceController');

// GET all resources
router.get('/', resourceController.getAllResources);

// GET a single resource by ID
router.get('/:id', resourceController.getResourceById);

// POST a new resource
router.post('/', resourceController.createResource);

// PUT update a resource
router.put('/:id', resourceController.updateResource);

// DELETE a resource
router.delete('/:id', resourceController.deleteResource);

module.exports = router;