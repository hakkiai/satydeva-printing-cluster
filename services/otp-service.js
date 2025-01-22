const db = require('../config/database');
const nodemailer = require('nodemailer');

class OTPService {
    static async generateOTP(userId) {
        try {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            
            // Store OTP in database
            const [user] = await db.query(
                'SELECT email FROM users WHERE id = ?',
                [userId]
            );

            await db.query(
                `INSERT INTO otp_storage (user_id, otp) VALUES (?, ?)`,
                [userId, otp]
            );

            if (process.env.NODE_ENV === 'production') {
                // Send email in production
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: user[0].email,
                    subject: 'Login OTP for Super Admin Access',
                    html: `
                        <h1>Super Admin Login OTP</h1>
                        <p>Your OTP for login is: <strong>${otp}</strong></p>
                        <p>This OTP will expire in 5 minutes.</p>
                    `
                });

                return 'OTP sent to your email';
            } else {
                // In development/testing, return OTP directly
                return otp;
            }
        } catch (error) {
            console.error('OTP generation error:', error);
            return null;
        }
    }

    static async verifyOTP(userId, otp) {
        try {
            const [records] = await db.query(
                `SELECT * FROM otp_storage 
                 WHERE user_id = ? 
                 AND otp = ? 
                 AND expires_at > NOW() 
                 AND is_used = FALSE 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId, otp]
            );

            if (records.length === 0) {
                return false;
            }

            // Mark OTP as used
            await db.query(
                `UPDATE otp_storage SET is_used = TRUE WHERE id = ?`,
                [records[0].id]
            );

            return true;
        } catch (error) {
            console.error('OTP verification error:', error);
            return false;
        }
    }

    static async cleanupOldOTPs() {
        try {
            await db.query(
                `DELETE FROM otp_storage 
                 WHERE expires_at < NOW() 
                 OR is_used = TRUE`
            );
        } catch (error) {
            console.error('OTP cleanup error:', error);
        }
    }
}

module.exports = OTPService; 