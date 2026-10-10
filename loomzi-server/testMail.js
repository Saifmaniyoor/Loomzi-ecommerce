require("dotenv").config();

const transporter = require("./config/mailer");

const testEmail = async () => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "Loomzi Email Test",
      text: "Hello! This is a test email from Loomzi.",
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);

  } catch (error) {
    console.error("Email sending failed!");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
  }
};

testEmail();