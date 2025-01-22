const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection and create initial setup
const initDatabase = async () => {
    try {
        const connection = await pool.promise().getConnection();
        console.log('Database connected successfully');

        // Create users table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'reception', 'accounts') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if admin user exists
        const [users] = await connection.query('SELECT * FROM users WHERE username = ?', [process.env.ADMIN_USERNAME]);
        
        if (users.length === 0) {
            // Create admin user if it doesn't exist
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            
            await connection.query(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [process.env.ADMIN_USERNAME, hashedPassword, 'admin']
            );
            console.log('Admin user created successfully');
        }

        connection.release();
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

initDatabase();

module.exports = pool.promise(); 