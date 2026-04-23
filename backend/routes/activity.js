// routes/activity.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
    const db = getDB();
    const activities = db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 20').all();
    res.json(activities);
});

module.exports = router;