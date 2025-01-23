// code for otp-service i viewed just sent to check out 

const db = require('../config/database');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { promisify } = require('util');

const hashAsync = promisify(crypto.pbkdf2);

class OTPService {
    static OTP_LENGTH = 6; // Configure OTP length
    static OTP_EXPIRATION_MINUTES = 5; // Configure OTP expiration time

    static async generateOTP(userId) {
        try {
            const otp = OTPService._generateNumericOTP();
            const hashedOTP = await OTPService._hashOTP(otp);

            // Retrieve user email
            const [user] = await db.query(
                'SELECT email FROM users WHERE id = ?',
                [userId]
            );

            if (!user || user.length === 0) {
                throw new Error('User not found');
            }

            // Store hashed OTP in database with expiration
            const expiresAt = new Date(Date.now() + OTPService.OTP_EXPIRATION_MINUTES * 60 * 1000);
            await db.query(
                `INSERT INTO otp_storage (user_id, otp, expires_at) VALUES (?, ?, ?)`,
                [userId, hashedOTP, expiresAt]
            );

            if (process.env.NODE_ENV === 'production') {
                // Send OTP via email in production
                await OTPService._sendEmail(user[0].email, otp);
                return 'OTP sent to your email';
            } else {
                // In development/testing, return the OTP directly
                return otp;
            }
        } catch (error) {
            console.error('OTP generation error:', error);
            throw new Error('Failed to generate OTP');
        }
    }

    static async verifyOTP(userId, otp) {
        try {
            const [record] = await db.query(
                `SELECT id, otp, expires_at, is_used FROM otp_storage 
                 WHERE user_id = ? 
                 AND is_used = FALSE
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId]
            );

            if (!record || record.length === 0) {
                return false;
            }

            const storedOTP = record[0];

            if (new Date(storedOTP.expires_at) < new Date() || storedOTP.is_used) {
                return false;
            }

            const isMatch = await OTPService._compareOTP(otp, storedOTP.otp);
            if (!isMatch) {
                return false;
            }

            // Mark OTP as used
            await db.query(
                `UPDATE otp_storage SET is_used = TRUE WHERE id = ?`,
                [storedOTP.id]
            );

            return true;
        } catch (error) {
            console.error('OTP verification error:', error);
            throw new Error('Failed to verify OTP');
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

    static _generateNumericOTP() {
        return crypto.randomInt(Math.pow(10, OTPService.OTP_LENGTH - 1), Math.pow(10, OTPService.OTP_LENGTH)).toString();
    }

    static async _hashOTP(otp) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hashed = await hashAsync(otp, salt, 1000, 64, 'sha512');
        return `${salt}$${hashed.toString('hex')}`;
    }

    static async _compareOTP(otp, hashedOTP) {
        const [salt, storedHash] = hashedOTP.split('$');
        const hashed = await hashAsync(otp, salt, 1000, 64, 'sha512');
        return storedHash === hashed.toString('hex');
    }

    static async _sendEmail(recipientEmail, otp) {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const emailTemplate = `
            <h1>Super Admin Login OTP</h1>
            <p>Your OTP for login is: <strong>${otp}</strong></p>
            <p>This OTP will expire in ${OTPService.OTP_EXPIRATION_MINUTES} minutes.</p>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: recipientEmail,
            subject: 'Login OTP for Super Admin Access',
            html: emailTemplate
        });
    }
}

module.exports = OTPService;
