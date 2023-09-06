const { verified_emails } = require("@cubitrix/models");

const main_helper = require("../helpers/index");
const email_helper = require("../helpers/email_template");
const crypto = require("crypto");
var nodemailer = require("nodemailer");

var transporter = nodemailer.createTransport({
  host: process.env.SENDER_EMAIL_HOST,
  port: process.env.SENDER_EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.SENDER_EMAIL_PASSWORD,
  },
});

// generate code for verification
async function generate_verification_code() {
  try {
    const token = crypto.randomBytes(16).toString("hex");
    return token;
  } catch (e) {
    return main_helper.error_message(e);
  }
}

// check_email_on_company
async function check_email_on_company(email) {
  try {
    const companyDomains = ["gmail.com", "company2.com", "examplecorp.com"];

    const parts = email.split("@");

    if (parts.length !== 2) {
      return false;
    }

    const domain = parts[1];

    if (companyDomains.includes(domain)) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

// checking if email is verified and sending if needed
async function check_and_send_verification_email(address, email) {
  let check_email = await check_email_on_company(email);

  if (!check_email) {
    return main_helper.error_message("Email isnot correct");
  }
  const results = await Promise.allSettled([
    generate_verification_code(),
    verified_emails.findOne({ address }),
    verified_emails.find({ email }),
  ]);
  if (results[0].status === "rejected")
    return main_helper.error_message(results[0].reason.toString());
  if (results[1].status === "rejected")
    return main_helper.error_message(results[1].reason.toString());
  if (results[2].status === "rejected")
    return main_helper.error_message(results[2].reason.toString());

  const email_verification_code = results[0].value;
  const verified_email_address = results[1].value;
  const verified_emails_all = results[2].value;

  const email_already_verified = verified_emails_all.some((obj) => obj.verified === true);

  if (email_already_verified)
    return main_helper.error_message("email already exists & is verified");

  if (verified_email_address) {
    await verified_email_address.updateOne({
      email,
      verified_at: null,
      verified: false,
      verification_code: email_verification_code,
      address,
    });

    let email_sent = await send_verification_mail(email, email_verification_code);

    if (email_sent.success) {
      return main_helper.success_message("email sent");
    }
    return main_helper.error_message("sending email failed");
  }

  await verified_emails.create({
    email: email,
    verified_at: null,
    verified: false,
    verification_code: email_verification_code,
    address: address,
  });
  // send email
  let email_sent = await send_verification_mail(email, email_verification_code);
  if (email_sent.success) {
    return main_helper.success_message("email sent");
  }
  return main_helper.error_message("sending email failed");
}

async function send_verification_mail(email, verification_code) {
  try {
    let check_email = await check_email_on_company(email);

    if (!check_email) {
      return main_helper.error_message("Email isnot correct");
    }

    var mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Verification Email",
      html: email_helper.verification_template(
        process.env.FRONTEND_URL + "/verify/" + verification_code,
      ),
    };

    await transporter.sendMail(mailOptions);
    return main_helper.success_message("Email sent");
  } catch (e) {
    console.log(e);
    return main_helper.error_message("sending email failed");
  }
}

async function send_reset_password_email(email, verification_code) {
  try {
    let check_email = await check_email_on_company(email);

    if (!check_email) {
      return main_helper.error_message("Email isnot correct");
    }

    var mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Reset Password",
      html: email_helper.reset_password_template(
        process.env.FRONTEND_URL + "/reset-password/" + verification_code,
      ),
    };

    await transporter.sendMail(mailOptions);
    return main_helper.success_message("Email sent");
  } catch (e) {
    console.log(e);
    return main_helper.error_message("sending email failed");
  }
}

module.exports = {
  generate_verification_code,
  check_and_send_verification_email,
  send_reset_password_email,
  send_verification_mail,
  check_email_on_company,
};
