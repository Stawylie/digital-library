const Resource = require('../models/Resource');

exports.getAllResources = async (req, res) => {
    try {
        const resources = await Resource.findAll();
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
};

exports.getResourceById = async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });
        res.json(resource);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch resource' });
    }
};

exports.createResource = async (req, res) => {
    try {
        const newResource = await Resource.create(req.body);
        res.status(201).json(newResource);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create resource' });
    }
};

exports.updateResource = async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });

        await resource.update(req.body);
        res.json(resource);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update resource' });
    }
};

exports.deleteResource = async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });

        await resource.destroy();
        res.json({ message: 'Resource deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete resource' });
    }
};