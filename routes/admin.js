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

router.get('/inventory', async (req, res) => {
    try {
        // Fetch categories from database
        const [categories] = await db.query('SELECT * FROM inventory_categories');
        
        res.render('dashboard/inventory', { 
            user: req.session.user,
            path: req.path,
            categories: categories
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).render('dashboard/inventory', { 
            user: req.session.user,
            path: req.path,
            categories: [],
            error: 'Error loading inventory data'
        });
    }
});

router.get('/sales', (req, res) => {
    res.render('dashboard/sales', { 
        user: req.session.user,
        path: req.path 
    });
});

router.get('/add-customer', (req, res) => {
    res.render('dashboard/add-customer', { 
        user: req.session.user,
        path: req.path 
    });
});

router.post('/add-customer', async (req, res) => {
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
    const { 
        id, 
        name, 
        firm_name, 
        firm_location, 
        gst_number, 
        email, 
        phone_number, 
        address 
    } = req.body;
    
    try {
        if (!name || !phone_number || !firm_name || !firm_location || !gst_number) {
            return res.status(400).json({ 
                success: false, 
                message: 'Required fields are missing' 
            });
        }

        if (id) {
            // Update existing customer
            await db.query(
                `UPDATE customers 
                 SET name = ?, firm_name = ?, firm_location = ?, gst_number = ?, 
                     email = ?, phone_number = ?, address = ? 
                 WHERE id = ?`,
                [name, firm_name, firm_location, gst_number, email, phone_number, address, id]
            );
        } else {
            // Add new customer
            await db.query(
                `INSERT INTO customers 
                 (name, firm_name, firm_location, gst_number, email, phone_number, address) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, firm_name, firm_location, gst_number, email, phone_number, address]
            );
        }
        
        res.json({ 
            success: true, 
            message: id ? 'Customer updated successfully' : 'Customer added successfully' 
        });
    } catch (error) {
        console.error('Save customer error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error saving customer information' 
        });
    }
});

// Get categories
router.get('/inventory/categories', async (req, res) => {
    try {
        const [categories] = await db.query('SELECT * FROM inventory_categories');
        res.json({ categories });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get subcategories by category
router.get('/inventory/subcategories/:categoryId', async (req, res) => {
    try {
        const [subcategories] = await db.query(
            'SELECT * FROM inventory_subcategories WHERE category_id = ?',
            [req.params.categoryId]
        );
        res.json({ subcategories });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get items by subcategory
router.get('/inventory/items/:subcategoryId', async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT 
                i.id,
                i.name,
                i.unit
            FROM inventory_items i
            WHERE i.subcategory_id = ?
            ORDER BY i.name
        `, [req.params.subcategoryId]);
        
        res.json({ items });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching items' 
        });
    }
});

// Get current inventory with category and subcategory names
router.get('/inventory/current', async (req, res) => {
    try {
        const [inventory] = await db.query(`
            SELECT 
                i.id,
                i.quantity,
                i.price,
                i.last_updated,
                i.name as item_name,
                c.name as category_name,
                s.name as subcategory_name
            FROM inventory_items i
            JOIN inventory_subcategories s ON i.subcategory_id = s.id
            JOIN inventory_categories c ON s.category_id = c.id
            ORDER BY c.name, s.name, i.name
        `);
        
        res.json({ inventory });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching inventory data' 
        });
    }
});

// Update inventory item
router.post('/inventory/update', async (req, res) => {
    const { itemId, quantity, price } = req.body;
    
    try {
        // Start transaction
        await db.query('START TRANSACTION');

        // Update item quantity and price
        const [result] = await db.query(
            `UPDATE inventory_items 
             SET quantity = quantity + ?, 
                 price = ?,
                 last_updated = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [quantity, price, itemId]
        );

        if (result.affectedRows === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                message: 'Item not found' 
            });
        }

        // Record transaction
        await db.query(
            `INSERT INTO inventory_transactions 
             (item_id, transaction_type, quantity, price, created_by) 
             VALUES (?, 'IN', ?, ?, ?)`,
            [itemId, quantity, price, req.session.user.id]
        );

        await db.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error updating inventory:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating inventory' 
        });
    }
});

// Get inventory by category
router.get('/inventory/by-category/:categoryId', async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT 
                i.id,
                i.quantity,
                i.price,
                i.last_updated,
                i.name as item_name,
                i.unit,
                s.name as subcategory_name
            FROM inventory_items i
            JOIN inventory_subcategories s ON i.subcategory_id = s.id
            WHERE s.category_id = ?
            ORDER BY s.name, i.name
        `, [req.params.categoryId]);
        
        res.json({ items });
    } catch (error) {
        console.error('Error fetching category items:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching inventory data' 
        });
    }
});

// Add these new routes for vendor management

// Render Add Vendor page
router.get('/add-vendor', (req, res) => {
    res.render('dashboard/add-vendor', { 
        user: req.session.user,
        path: req.path 
    });
});

// Search vendors
router.get('/search-vendor', async (req, res) => {
    const { term } = req.query;
    try {
        const [vendors] = await db.query(
            `SELECT * FROM vendors 
             WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ?`,
            [`%${term}%`, `%${term}%`, `%${term}%`]
        );
        res.json({ vendors });
    } catch (error) {
        console.error('Vendor search error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error searching vendors' 
        });
    }
});

// Save/Update vendor
router.post('/save-vendor', async (req, res) => {
    const { 
        id, 
        name, 
        phone_number, 
        email, 
        gst_number, 
        hsn_number,
        invoice_number,
        date_of_supply 
    } = req.body;
    
    try {
        await db.query('START TRANSACTION');

        if (id) {
            // Update existing vendor
            await db.query(
                `UPDATE vendors 
                 SET name = ?, phone_number = ?, email = ?, 
                     gst_number = ?, hsn_number = ?
                 WHERE id = ?`,
                [name, phone_number, email, gst_number, hsn_number, id]
            );

            // Add new invoice for existing vendor
            await db.query(
                `INSERT INTO vendor_invoices 
                 (vendor_id, invoice_number, date_of_supply) 
                 VALUES (?, ?, ?)`,
                [id, invoice_number, date_of_supply]
            );
        } else {
            // Add new vendor
            const [result] = await db.query(
                `INSERT INTO vendors 
                 (name, phone_number, email, gst_number, hsn_number) 
                 VALUES (?, ?, ?, ?, ?)`,
                [name, phone_number, email, gst_number, hsn_number]
            );
            
            // Add invoice for new vendor
            await db.query(
                `INSERT INTO vendor_invoices 
                 (vendor_id, invoice_number, date_of_supply) 
                 VALUES (?, ?, ?)`,
                [result.insertId, invoice_number, date_of_supply]
            );
        }

        await db.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: id ? 'Vendor updated successfully' : 'Vendor added successfully' 
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Save vendor error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error saving vendor information' 
        });
    }
});

// Get vendor details
router.get('/vendor/:id', async (req, res) => {
    try {
        const [vendors] = await db.query(
            `SELECT v.*, vi.invoice_number, vi.date_of_supply 
             FROM vendors v
             LEFT JOIN vendor_invoices vi ON v.id = vi.vendor_id
             WHERE v.id = ?
             ORDER BY vi.created_at DESC
             LIMIT 1`,
            [req.params.id]
        );
        
        if (vendors.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Vendor not found' 
            });
        }
        
        res.json({ 
            success: true, 
            vendor: vendors[0] 
        });
    } catch (error) {
        console.error('Get vendor error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching vendor details' 
        });
    }
});

// Delete vendor
router.delete('/vendor/:id', async (req, res) => {
    try {
        await db.query('START TRANSACTION');

        // Delete vendor invoices first
        await db.query('DELETE FROM vendor_invoices WHERE vendor_id = ?', [req.params.id]);
        
        // Then delete vendor
        await db.query('DELETE FROM vendors WHERE id = ?', [req.params.id]);

        await db.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: 'Vendor deleted successfully' 
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Delete vendor error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting vendor' 
        });
    }
});

// Add this new route to get vendor transactions
router.get('/inventory/vendor/:vendorId', async (req, res) => {
    try {
        const [transactions] = await db.query(`
            SELECT 
                t.created_at,
                i.name as item_name,
                i.unit,
                t.quantity,
                t.price
            FROM inventory_transactions t
            JOIN inventory_items i ON t.item_id = i.id
            WHERE t.vendor_id = ?
            ORDER BY t.created_at DESC
            LIMIT 50
        `, [req.params.vendorId]);
        
        res.json({ transactions });
    } catch (error) {
        console.error('Error fetching vendor transactions:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching transaction data' 
        });
    }
});

module.exports = router; 