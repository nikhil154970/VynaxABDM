/**
 * Assistant Routes
 * ----------------
 * Handles pharmacy/patient assistant queries by routing them to the Mytho_AI Python service.
 * Uses native fetch (Node 18+) — no external HTTP client required.
 */

const express = require('express');

const router = express.Router();

const ASSISTANT_SERVICE_URL = process.env.ASSISTANT_SERVICE_URL || 'http://localhost:5001';
const ASSISTANT_TIMEOUT = parseInt(process.env.ASSISTANT_TIMEOUT || '60000', 10);

/**
 * Health check for assistant service
 * GET /api/assistant/health
 */
router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${ASSISTANT_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    res.json({ status: 'healthy', assistant_service: data });
  } catch (error) {
    console.error('[Assistant] Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Assistant service is not responding',
      message: error.message,
    });
  }
});

/**
 * Get assistant status and capabilities
 * GET /api/assistant/status
 */
router.get('/status', async (req, res) => {
  try {
    const response = await fetch(`${ASSISTANT_SERVICE_URL}/api/status`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Assistant] Status check failed:', error.message);
    res.status(503).json({
      status: 'error',
      error: 'Failed to fetch assistant status',
      message: error.message,
    });
  }
});

/**
 * Process a user query through the assistant
 * POST /api/assistant/query
 */
router.post('/query', async (req, res) => {
  try {
    const { message, module = 'pharmacy' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: "message" is required and must be a string',
        reply: 'Please provide a message',
        intent: 'ERROR',
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: message cannot be empty',
        reply: 'Message cannot be empty',
        intent: 'ERROR',
      });
    }

    let userId = null;
    let uhid = req.body.uhid || null;
    let role = module === 'patient' ? 'patient' : 'pharmacist';
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();
        const { verifyAccessToken } = require('../config/jwt');
        const decoded = verifyAccessToken(token);
        userId = decoded.patientId || decoded.userId || decoded.id;
        uhid = decoded.uhid || uhid;
        role = (decoded.role || role).toLowerCase();
      }
    } catch {
      // Token invalid or missing - proceed without auth
    }

    console.log(`[Assistant] Query: "${trimmedMessage.substring(0, 50)}..." | module=${module} | userId=${userId} | uhid=${uhid} | role=${role}`);

    const response = await fetch(`${ASSISTANT_SERVICE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmedMessage,
        language: 'english',
        module,
        userId,
        uhid,
        role,
      }),
      signal: AbortSignal.timeout(ASSISTANT_TIMEOUT),
    });

    const data = await response.json();

    console.log(`[Assistant] Response: intent=${data.intent}`);

    res.json(data);
  } catch (error) {
    console.error('[Assistant] Query error:', error.message);

    if (error.cause?.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({
        reply: 'Assistant service is not available. Please ensure the Mytho_AI service is running.',
        intent: 'ERROR',
        language: 'english',
        error: 'Assistant service unavailable',
      });
    }

    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return res.status(504).json({
        reply: 'Assistant request timed out. Please try again.',
        intent: 'ERROR',
        language: 'english',
        error: 'Request timeout',
      });
    }

    res.status(500).json({
      reply: 'An unexpected error occurred while processing your request.',
      intent: 'ERROR',
      language: 'english',
      error: error.message,
    });
  }
});

/**
 * Pharmacy-specific assistant endpoint
 * POST /api/assistant/pharmacy/query
 */
router.post('/pharmacy/query', async (req, res) => {
  req.body.module = 'pharmacy';
  const mainQueryHandler = router.stack.find(
    r => r.route && r.route.path === '/query' && r.route.methods.post
  );
  if (mainQueryHandler) {
    return mainQueryHandler.handle(req, res);
  }
  res.status(500).json({ error: 'Handler not found' });
});

/**
 * Patient-specific assistant endpoint
 * POST /api/assistant/patient/query
 */
router.post('/patient/query', async (req, res) => {
  req.body.module = 'patient';
  const mainQueryHandler = router.stack.find(
    r => r.route && r.route.path === '/query' && r.route.methods.post
  );
  if (mainQueryHandler) {
    return mainQueryHandler.handle(req, res);
  }
  res.status(500).json({ error: 'Handler not found' });
});

/**
 * Text-to-Speech endpoint
 * POST /api/assistant/tts
 */
router.post('/tts', async (req, res) => {
  try {
    const { text, lang = 'en' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const response = await fetch(`${ASSISTANT_SERVICE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), lang }),
      signal: AbortSignal.timeout(30000),
    });

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error('[Assistant] TTS error:', error.message);
    if (error.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }
    res.status(500).json({ error: 'TTS request failed' });
  }
});

module.exports = router;
