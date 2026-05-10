// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

// ========== REGISTER ==========
router.post('/register', (req, res) => {
    try {
        let { name, email, password, role } = req.body;

        // تحويل الإيميل إلى حروف صغيرة
        if (email) email = email.toLowerCase().trim();

        // منع تعيين دور غير "user" ذاتياً
        if (role && role !== 'user') {
            return res.status(403).json({ error: 'Cannot self-assign role' });
        }
        role = 'user';

        // التحقق من الحقول المطلوبة
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password required' });
        }

        const db = getDB();

        // التأكد من أن الإيميل غير مسجل مسبقاً
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // تجزئة كلمة المرور
        const hashedPassword = bcrypt.hashSync(password, 10);

        // إدخال المستخدم الجديد
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
            name, email, hashedPassword, role
        );
		
		
		db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
			'user', `New user registered: ${name}`, new Date().toLocaleString(), null, name
		);
		
        // تسجيل النشاط
		/*
        db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run(
            'user', `New user registered: ${name}`, new Date().toLocaleString()
        );
		*/
        res.status(201).json({ message: 'Account created successfully' });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== LOGIN ==========
router.post('/login', (req, res) => {
    try {
        let { email, password } = req.body;

        // تحويل الإيميل إلى حروف صغيرة
        if (email) email = email.toLowerCase().trim();

        console.log('Login attempt:', email);  // للتشخيص فقط، يمكن إزالته لاحقاً

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // إنشاء JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // إرجاع التوكن وبيانات المستخدم (بدون كلمة المرور)
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

        // تسجيل النشاط
        /*
		db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run(
            'login', `${user.name} logged in`, new Date().toLocaleString()
        );
		*/
		db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
			'login', `${user.name} logged in`, new Date().toLocaleString(), user.id, user.name
		);

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;