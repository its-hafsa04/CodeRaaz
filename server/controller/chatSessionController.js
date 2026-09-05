const db = require('../utils/db');
const crypto = require('crypto');

exports.getRepositories = async (req, res, next) => {
  try {
    const repos = await db.all("SELECT id, name, url, created_at, updated_at FROM repositories ORDER BY created_at DESC");
    res.status(200).json(repos);
  } catch (error) {
    next(error);
  }
};

exports.getChatSessions = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const sessions = await db.all("SELECT id, repo_id, created_at, updated_at FROM chat_sessions WHERE repo_id = ? ORDER BY created_at DESC", [repoId]);
    res.status(200).json(sessions);
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const messages = await db.all("SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", [sessionId]);
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

exports.createChatSession = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await db.run("INSERT INTO chat_sessions (id, repo_id, created_at, updated_at) VALUES (?, ?, ?, ?)", [sessionId, repoId, now, now]);
    
    res.status(201).json({ id: sessionId, repo_id: repoId, created_at: now, updated_at: now });
  } catch (error) {
    next(error);
  }
};
