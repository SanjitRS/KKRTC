const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, get, all } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'nitte_bus_tracker_secret_2026';

// Middleware to verify JWT token
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Student Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, usn, password, phone, route_id, stop_id } = req.body;

    if (!name || !password || (!email && !usn)) {
      return res.status(400).json({ error: 'Name, password, and either email or USN are required' });
    }

    // Check duplicate email or USN
    if (email) {
      const existingEmail = await get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      if (existingEmail) return res.status(409).json({ error: 'User with this email already exists' });
    }

    if (usn) {
      const existingUsn = await get('SELECT id FROM users WHERE UPPER(usn) = UPPER(?)', [usn]);
      if (existingUsn) return res.status(409).json({ error: 'User with this USN already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = `user-stu-${Date.now()}`;

    await query(
      `INSERT INTO users (id, name, email, usn, phone, password_hash, role, route_id, stop_id)
       VALUES (?, ?, ?, ?, ?, ?, 'student', ?, ?)`,
      [userId, name, email || null, usn ? usn.toUpperCase() : null, phone || null, passwordHash, route_id || null, stop_id || null]
    );

    const user = await get(
      `SELECT u.id, u.name, u.email, u.usn, u.phone, u.role, u.route_id, u.stop_id,
              r.name as route_name, r.code as route_code, s.name as stop_name
       FROM users u
       LEFT JOIN routes r ON u.route_id = r.id
       LEFT JOIN stops s ON u.stop_id = s.id
       WHERE u.id = ?`,
      [userId]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, usn: user.usn },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Failed to register student' });
  }
});

// Login (email or USN)
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/USN and password are required' });
    }

    // Look up by email or USN
    const user = await get(
      `SELECT u.id, u.name, u.email, u.usn, u.phone, u.password_hash, u.role, u.route_id, u.stop_id,
              r.name as route_name, r.code as route_code, s.name as stop_name
       FROM users u
       LEFT JOIN routes r ON u.route_id = r.id
       LEFT JOIN stops s ON u.stop_id = s.id
       WHERE LOWER(u.email) = LOWER(?) OR UPPER(u.usn) = UPPER(?)`,
      [identifier, identifier]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Strip password hash from response
    delete user.password_hash;

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, usn: user.usn },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Fast Demo Switch/Login (convenient for testing student, driver, admin)
router.post('/demo-login', async (req, res) => {
  try {
    const { role = 'student', userId } = req.body;

    let user;
    if (userId) {
      user = await get(
        `SELECT u.id, u.name, u.email, u.usn, u.phone, u.role, u.route_id, u.stop_id,
                r.name as route_name, r.code as route_code, s.name as stop_name
         FROM users u
         LEFT JOIN routes r ON u.route_id = r.id
         LEFT JOIN stops s ON u.stop_id = s.id
         WHERE u.id = ?`,
        [userId]
      );
    } else {
      user = await get(
        `SELECT u.id, u.name, u.email, u.usn, u.phone, u.role, u.route_id, u.stop_id,
                r.name as route_name, r.code as route_code, s.name as stop_name
         FROM users u
         LEFT JOIN routes r ON u.route_id = r.id
         LEFT JOIN stops s ON u.stop_id = s.id
         WHERE u.role = ?
         ORDER BY u.id ASC LIMIT 1`,
        [role]
      );
    }

    if (!user) {
      return res.status(404).json({ error: `No demo user found for role ${role}` });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, usn: user.usn },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error('[AUTH] Demo login error:', err);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

// Get current logged-in user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await get(
      `SELECT u.id, u.name, u.email, u.usn, u.phone, u.role, u.route_id, u.stop_id,
              r.name as route_name, r.code as route_code, s.name as stop_name
       FROM users u
       LEFT JOIN routes r ON u.route_id = r.id
       LEFT JOIN stops s ON u.stop_id = s.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    console.error('[AUTH] Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update preferred bus route and boarding stop
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { route_id, stop_id, name, phone } = req.body;

    await query(
      `UPDATE users 
       SET route_id = COALESCE(?, route_id),
           stop_id = COALESCE(?, stop_id),
           name = COALESCE(?, name),
           phone = COALESCE(?, phone)
       WHERE id = ?`,
      [route_id, stop_id, name, phone, req.user.id]
    );

    const user = await get(
      `SELECT u.id, u.name, u.email, u.usn, u.phone, u.role, u.route_id, u.stop_id,
              r.name as route_name, r.code as route_code, s.name as stop_name
       FROM users u
       LEFT JOIN routes r ON u.route_id = r.id
       LEFT JOIN stops s ON u.stop_id = s.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('[AUTH] Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
