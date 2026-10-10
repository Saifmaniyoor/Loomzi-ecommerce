const transporter = require("../config/mailer");

const sendAdminWelcomeEmail = async (admin) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: admin.email,
    subject: "Welcome to Loomzi Admin",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #50352b;">Welcome to Loomzi!</h2>

        <p>Hello ${admin.fullName},</p>

        <p>
          Your Super Admin account has been created successfully.
        </p>

        <p>
          You can now log in to the Loomzi Admin Dashboard
          using your registered email and password.
        </p>

        <p><strong>Email:</strong> ${admin.email}</p>

        <p>Thank you,<br/>Loomzi Team</p>
      </div>
    `,
  });
};

module.exports = { sendAdminWelcomeEmail };