const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function createSuperAdmin() {
    try {
        // Generate hashed password
        const password = 'root'; // This is the password you'll use to login
        const hashedPassword = await bcrypt.hash(password, 10);

        // First check if super admin exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE username = ?', 
            [process.env.SUPER_ADMIN_USERNAME]
        );

        if (existingUsers.length > 0) {
            // Update existing super admin
            await db.query(
                `UPDATE users 
                 SET password = ?, email = ? 
                 WHERE username = ?`,
                [hashedPassword, process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_USERNAME]
            );
            console.log('Super admin updated successfully');
        } else {
            // Create new super admin
            await db.query(
                `INSERT INTO users (username, password, role, email) 
                 VALUES (?, ?, 'super_admin', ?)`,
                [process.env.SUPER_ADMIN_USERNAME, hashedPassword, process.env.SUPER_ADMIN_EMAIL]
            );
            console.log('Super admin created successfully');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createSuperAdmin(); 