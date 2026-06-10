import nodemailer from 'nodemailer';

export const sendResetEmail = async (toEmail, resetCode) => {
  let transporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Fallback to auto-generated Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('No SMTP config found. Using Ethereal test account:', testAccount.user);
  }

  const mailOptions = {
    from: '"Finance Portal" <noreply@deped.gov.ph>',
    to: toEmail,
    subject: 'Password Reset Verification Code',
    text: `You requested a password reset. Your 6-digit verification code is: ${resetCode}`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0B3A68; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">InsightED Finance</h2>
        </div>
        <div style="padding: 20px; text-align: center;">
          <h3 style="margin-top: 0;">Password Reset Request</h3>
          <p>You recently requested to reset your password for your InsightED Finance account.</p>
          <p>Please enter the following 6-digit code to proceed. This code is valid for 15 minutes.</p>
          <div style="margin: 30px 0;">
            <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0B3A68;">${resetCode}</span>
            </div>
          </div>
          <p style="font-size: 12px; color: #777;">If you did not request a password reset, please ignore this email.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send reset email.');
  }
};
