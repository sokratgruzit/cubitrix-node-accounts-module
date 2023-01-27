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
    // let verified_all = await verified_emails.find({
    //   address,
    // });

    const verified_all = await verified_emails.find({
      email,
    });

    // console.log(verified_all, verified_all_email);

    if (verified_all.length > 0) {
      let verified_status = false;
      let verified = null;
      for (let i = 0; i < verified_all.length; i++) {
        let verified_one = verified_all[i];
        if (verified_one.verified) {
          verified_status = true;
          verified = verified_one;
        }
      }
      if (verified) {
        return main_helper.return_data(true, {
          verified: verified_status,
          exists: true,
          data: verified,
        });
      } else {
        return main_helper.return_data(true, {
          verified: false,
          exists: true,
          data: null,
        });
      }
    } else {
      return main_helper.return_data(true, {
        verified: false,
        exists: false,
        data: null,
      });
    }
  } catch (e) {
    console.log(e.message);
    return main_helper.error_message(e.message);
  }
}
// checking if email is verified and sending if needed
async function check_and_send_verification_email(address, email) {
  let email_verification_code = await generate_verification_code();
  let verified = await check_email_verified(address, email);
  if (verified && verified.data) {
    let data = verified.data;
    if (data.exists) {
      if (data.verified && email === data?.data?.email) {
        return main_helper.error_message("email already exists & is verified");
      } else {
        // save in db
        let verify = await verified_emails.create({
          email: email,
          verified_at: null,
          verified: false,
          verification_code: email_verification_code,
          address: address,
        });
        // send email
        let email_sent = await send_verification_mail(
          email,
          email_verification_code
        );
        if (email_sent.success) {
          return main_helper.success_message("email sent");
        } else {
          return main_helper.error_message("sending email failed");
        }
      }
    } else {
      // save in db
      let verify = await verified_emails.create({
        email: email,
        verified_at: null,
        verified: false,
        verification_code: email_verification_code,
        address: address,
      });
      // send email
      let email_sent = await send_verification_mail(
        email,
        email_verification_code
      );
      if (email_sent.success && verify) {
        return main_helper.success_message("email sent");
      } else {
        return main_helper.error_message("sending email failed");
      }
    }
  } else {
    return main_helper.error_message("error");
  }
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
      process.env.FRONTEND_URL + "/verify/" + verification_code
    ),
  };

  let response;
  await transporter.sendMail(mailOptions).catch((e) => {
    response = main_helper.error_message("sending email failed");
  });
  response = main_helper.success_message("Email sent");

  return response;
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
