const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const db = require('../config/database');

router.use(isAuthenticated, isAdmin);

router.get('/dashboard', (req, res) => {
    res.render('dashboard/admin', { 
        user: req.session.user,
        path: req.path 
    });
});

router.get('/inventory', (req, res) => {
    res.render('dashboard/inventory', { 
        user: req.session.user,
        path: req.path 
    });
});

router.get('/sales', (req, res) => {
    res.render('dashboard/sales', { 
        user: req.session.user,
        path: req.path 
    });
});

router.get('/add-user', (req, res) => {
    res.render('dashboard/add-user', { user: req.session.user });
});

router.post('/add-user', async (req, res) => {
    const { username, password, role } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Search customers
router.get('/search-customer', async (req, res) => {
    const { term } = req.query;
    try {
        const [customers] = await db.query(
            `SELECT * FROM customers 
             WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ?`,
            [`%${term}%`, `%${term}%`, `%${term}%`]
        );
        res.json({ customers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Save/Update customer
router.post('/save-customer', async (req, res) => {
    const { id, name, email, phone_number, address } = req.body;
    
    try {
        if (!name || !phone_number) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name and phone number are required' 
            });
        }

        if (id) {
            // Update existing customer
            const [result] = await db.query(
                `UPDATE customers 
                 SET name = ?, email = ?, phone_number = ?, address = ? 
                 WHERE id = ?`,
                [name, email, phone_number, address, id]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Customer not found' 
                });
            }
        } else {
            // Add new customer
            const [result] = await db.query(
                `INSERT INTO customers (name, email, phone_number, address) 
                 VALUES (?, ?, ?, ?)`,
                [name, email, phone_number, address]
            );
            
            if (result.affectedRows === 0) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to create customer' 
                });
            }
        }
        
        res.json({ 
            success: true, 
            message: id ? 'Customer updated successfully' : 'Customer created successfully' 
        });
    } catch (error) {
        console.error('Save customer error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error occurred' 
        });
    }
});

module.exports = router; 