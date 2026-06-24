const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

const GMAIL_ADDRESS = "offspeedbaseball.co1@gmail.com";

// Only your App Password needs to be a secret — the email is already public
const gmailPass = defineSecret("GMAIL_APP_PASSWORD");

setGlobalOptions({ region: "us-central1" });

exports.sendWelcomeEmail = onDocumentCreated(
  {
    document: "customers/{customerId}",
    secrets: [gmailPass],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data?.email) return;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_ADDRESS,
        pass: gmailPass.value(), // Gmail App Password (not your real password)
      },
    });

    const mailOptions = {
      from: `"OFFspeed Baseball" <${GMAIL_ADDRESS}>`,
      to: data.email,
      subject: "Welcome to OFFspeed Baseball! ⚾",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Welcome to OFFspeed Baseball${data.name ? `, ${data.name}` : ""}! ⚾</h2>
          <p>Thanks for signing in — we're stoked to have you.</p>
          <p>You're now part of the OFFspeed community. Browse our gear, check out the latest listings, and stay tuned for new drops.</p>
          <p style="margin-top: 32px;">See you on the diamond,<br/><strong>The OFFspeed Team</strong></p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${data.email}`);
    } catch (err) {
      console.error("Failed to send welcome email:", err);
    }
  }
);
