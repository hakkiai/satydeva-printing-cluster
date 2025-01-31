const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { isAuthenticated } = require('../middleware/auth');
const db = require('../config/database');

// Super admin middleware
const isSuperAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'super_admin') {
        return next();
    }
    res.status(403).send('Access denied');
};

router.use(isAuthenticated, isSuperAdmin);

router.get('/dashboard', (req, res) => {
    res.render('dashboard/super-admin', { 
        user: req.session.user,
        path: req.path 
    });
});

// Get Add User page with existing users list
router.get('/add-user', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, role, created_at FROM users WHERE role != ?',
            ['super_admin']
        );
        
        res.render('dashboard/super-admin-add-user', { 
            user: req.session.user,
            users: users,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// Add new user
router.post('/add-user', async (req, res) => {
    const { username, password, role } = req.body;
    
    try {
        // Check if username already exists
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.render('dashboard/super-admin-add-user', {
                user: req.session.user,
                users: await getUsers(),
                message: {
                    type: 'error',
                    text: 'Username already exists'
                }
            });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        const [users] = await db.query(
            'SELECT id, username, role, created_at FROM users WHERE role != ?',
            ['super_admin']
        );

        res.render('dashboard/super-admin-add-user', {
            user: req.session.user,
            users: users,
            message: {
                type: 'success',
                text: 'User added successfully'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// Delete user
router.delete('/delete-user/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

async function getUsers() {
    const [users] = await db.query(
        'SELECT id, username, role, created_at FROM users WHERE role != ?',
        ['super_admin']
    );
    return users;
}

router.get('/manage-admins', (req, res) => {
    // Implement admin management page
    res.render('dashboard/manage-admins', { user: req.session.user });
});

router.get('/system-settings', (req, res) => {
    // Implement settings page
    res.render('dashboard/system-settings', { user: req.session.user });
});

module.exports = router; 