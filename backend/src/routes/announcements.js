const express = require('express');
const router = express.Router();
const { query, get, all } = require('../config/db');
const { getIo } = require('../services/trackingEngine');

// GET all active announcements (optionally filter by route_id)
router.get('/', async (req, res) => {
  try {
    const { routeId } = req.query;

    let sql = `
      SELECT a.*, r.name as route_name, r.code as route_code, u.name as author_name
      FROM announcements a
      LEFT JOIN routes r ON a.route_id = r.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.is_active = 1
    `;
    const params = [];

    if (routeId) {
      sql += ' AND (a.route_id IS NULL OR a.route_id = ?)';
      params.push(routeId);
    }

    sql += ' ORDER BY CASE WHEN a.priority = \'urgent\' THEN 0 ELSE 1 END, a.created_at DESC';

    const announcements = await all(sql, params);
    res.json({ success: true, announcements });
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ADMIN: Post new announcement
router.post('/', async (req, res) => {
  try {
    const { title, message, category = 'general', priority = 'normal', route_id = null, author_id = null } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const id = `ann-${Date.now()}`;
    await query(
      `INSERT INTO announcements (id, title, message, category, priority, route_id, author_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, title, message, category, priority, route_id || null, author_id || null]
    );

    const created = await get(`
      SELECT a.*, r.name as route_name, r.code as route_code, u.name as author_name
      FROM announcements a
      LEFT JOIN routes r ON a.route_id = r.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [id]);

    // Broadcast via Socket.IO
    const io = getIo();
    if (io) {
      if (route_id) {
        io.to(`route:${route_id}`).emit('announcement:new', created);
      }
      io.to('global').emit('announcement:new', created);
    }

    res.status(201).json({ success: true, announcement: created });
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Post error:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// ADMIN: Delete / Deactivate announcement
router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE announcements SET is_active = 0 WHERE id = ?', [req.params.id]);
    
    const io = getIo();
    if (io) {
      io.to('global').emit('announcement:deleted', { id: req.params.id });
    }

    res.json({ success: true, message: 'Announcement archived successfully' });
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
