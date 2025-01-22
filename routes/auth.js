const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const OTPService = require('../services/otp-service');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).render('login', { error: 'Invalid credentials' });
        }

        if (user.role === 'super_admin') {
            // Generate OTP
            const otp = await OTPService.generateOTP(user.id);
            
            if (!otp) {
                return res.status(500).render('login', { error: 'Error generating OTP' });
            }

            // Store user info in session (but not logged in yet)
            req.session.pendingUser = {
                id: user.id,
                username: user.username,
                role: user.role
            };

            // Display OTP (in production, this should be sent via SMS or secure channel)
            return res.render('otp-verification', { 
                message: `Your OTP is: ${otp} (Valid for 5 minutes)` 
            });
        }

        // For non-super-admin users
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        switch (user.role) {
            case 'admin':
                return res.redirect('/admin/dashboard');
            default:
                return res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        res.status(500).render('login', { error: 'Server error occurred' });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { otp } = req.body;
    const pendingUser = req.session.pendingUser;

    if (!pendingUser) {
        return res.status(401).render('login', { error: 'Session expired' });
    }

    try {
        const isValid = await OTPService.verifyOTP(pendingUser.id, otp);

        if (!isValid) {
            return res.render('otp-verification', { 
                error: 'Invalid or expired OTP',
                message: 'Please try again'
            });
        }

        // OTP is valid - log the user in
        req.session.user = pendingUser;
        delete req.session.pendingUser;

        res.redirect('/super-admin/dashboard');
    } catch (error) {
        console.error(error);
        res.render('otp-verification', { error: 'Server error occurred' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router; 