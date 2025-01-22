const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

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

router.get('/manage-admins', (req, res) => {
    // Implement admin management page
    res.render('dashboard/manage-admins', { user: req.session.user });
});

router.get('/system-settings', (req, res) => {
    // Implement settings page
    res.render('dashboard/system-settings', { user: req.session.user });
});

module.exports = router; 