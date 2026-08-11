const express = require('express');
const router = express.Router();
const indexController = require('../controller/indexController');
const queryController = require('../controller/queryController');
const chatController = require('../controller/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected Code Indexing Endpoints
router.post('/index', authMiddleware, indexController.indexDirectory);
router.delete('/index', authMiddleware, indexController.clearIndex);
router.get('/index/status', authMiddleware, indexController.getStatus);
router.get('/index/files', authMiddleware, indexController.getFiles);

// Protected Chat Endpoint
router.post('/chat', authMiddleware, chatController.ask);

// Protected RAG Query Endpoint
router.post('/query', authMiddleware, queryController.query);

module.exports = router;
