const accounts = require("../models/accounts/accounts");
const account_meta = require("../models/accounts/account_meta");
const account_auth = require("../models/accounts/account_auth");
const account_types = require("../models/accounts/account_types");
const verified_emails = require("../models/accounts/verified_emails");
const main_helper = require("../helpers/index");
const crypto = require("crypto");
var nodemailer = require("nodemailer");

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
      return type._id;
    }
    return 0;
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
// generate code for verification
async function generate_verification_code() {
  try {
    const token = crypto.randomBytes(16).toString("hex");
    if (token) {
      return token;
    }
    return main_helper.error_message("error generating code");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
// method to check if email already verified in db
async function check_email_verified(address, email) {
  try {
    let verified = await verified_emails.findOne({
      address: address,
      email: email,
    });

    if (verified) {
      if (verified.verified) {
        return main_helper.return_data(true, {
          verified: true,
          exists: true,
          data: verified,
        });
      }
      return main_helper.return_data(true, {
        verified: false,
        exists: true,
        data: verified,
      });
    } else {
      return main_helper.return_data(true, {
        verified: false,
        exists: false,
        data: null,
      });
    }
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
// checking if email is verified and sending if needed
async function check_and_send_verification_email(address, email) {
  let email_verification_code =
    await account_helper.generate_verification_code();
  let verified = await check_email_verified(address, email);
  if (verified && verified.data) {
    let data = verified.data;
    if (data.exists) {
      if (data.verified) {
        // save in db

        // send email, somebody entered your email to register on our site
        let email_sent = await send_mail(email, data);
        if (email_sent.success) {
          return main_helper.error_message(
            "email already exists and email owner will be notified about this fact"
          );
        } else {
          return main_helper.error_message("email already exists");
        }
      } else {
        // save in db

        // send email
        let email_sent = await send_verification_mail(email, data);
        if (email_sent.success) {
          return main_helper.success_message("email sent");
        } else {
          return main_helper.error_message("sending email failed");
        }
      }
    } else {
      // save in db

      // send email
      let email_sent = await send_verification_mail(email, data);
      if (email_sent.success) {
        return main_helper.success_message("email sent");
      } else {
        return main_helper.error_message("sending email failed");
      }
    }
  } else {
    return verified;
  }
}
async function send_verification_mail(email, data) {
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
    subject: "Sending Email using Node.js",
    text: "That was easy!",
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}
async function send_mail() {}

module.exports = {
  check_account_meta_exists,
  check_account_exists,
  get_type_id,
  generate_verification_code,
  check_email_verified,
  check_and_send_verification_email,
  send_verification_mail,
};
