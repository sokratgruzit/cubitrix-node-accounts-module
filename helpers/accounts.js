const {
  accounts,
  account_meta,
  account_types,
  verified_emails,
} = require("@cubitrix/models");

const main_helper = require("../helpers/index");
const email_helper = require("../helpers/email_template");
const crypto = require("crypto");
var nodemailer = require("nodemailer");
const { findOne } = require("@cubitrix/models/options");

// checking if account meta data already exists
async function check_account_meta_exists(address) {
  try {
    let find_meta = await account_meta.findOne({
      address: address,
    });
    if (find_meta) {
      return main_helper.success_message(true);
    }

    return main_helper.success_message(false);
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
// method to check if account already exists in db
async function check_account_exists(address, type_id) {
  try {
    let account = await accounts.findOne({
      address: address,
      account_type_id: type_id,
    });

    if (account && account?.address) {
      return main_helper.success_message("Account found");
    } else {
      return main_helper.error_message("Account not Found");
    }
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
// getting type id from db
async function get_type_id(type_name) {
  try {
    let type = await account_types.findOne({ name: type_name }).exec();

    if (type) {
      let type_id = type._id;
      return type_id.toString();
    }
    /*else {
      await account_types.create({ name: type_name }).exec();
      type = await account_types.findOne({ name: type_name }).exec();
      return type._id;
    }*/
    return 0;
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

// generate code for verification
async function generate_verification_code() {
  try {
    const token = crypto.randomBytes(16).toString("hex");
    return token;
  } catch (e) {
    return main_helper.error_message(e);
  }
}
// checking if email is verified and sending if needed
async function check_and_send_verification_email(address, email) {
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
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SENDER_EMAIL,
      pass: process.env.SENDER_EMAIL_PASSWORD,
    },
  });

  var mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: "Verification Email",
    html: email_helper.verification_template(
      process.env.FRONTEND_URL + "/verify/" + verification_code,
    ),
  };

  let response;
  await transporter.sendMail(mailOptions).catch((e) => {
    response = main_helper.error_message("sending email failed");
  });
  response = main_helper.success_message("Email sent");

  return response;
}

async function send_reset_password_email(email, verification_code) {
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SENDER_EMAIL,
      pass: process.env.SENDER_EMAIL_PASSWORD,
    },
  });

  var mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: "Reset Password",
    html: email_helper.reset_password_template(
      process.env.FRONTEND_URL + "/reset-password/" + verification_code,
    ),
  };

  let response;
  await transporter.sendMail(mailOptions).catch((e) => {
    response = main_helper.error_message("sending email failed");
  });
  response = main_helper.success_message("Email sent");

  return response;
}

module.exports = {
  check_account_meta_exists,
  check_account_exists,
  get_type_id,
  generate_verification_code,
  check_and_send_verification_email,
  send_reset_password_email,
  send_verification_mail,
};
