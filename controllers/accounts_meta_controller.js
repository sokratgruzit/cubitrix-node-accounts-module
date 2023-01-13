const account_meta = require("../models/accounts/account_meta");
const verified_emails = require("../models/accounts/verified_emails");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
require("dotenv").config();

// logic of checking profile info
async function update_meta(req, res) {
  try {
    let { address, name, email, mobile, date_of_birth, nationality, avatar } =
      req.body;

    if (address == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("Fill all fields")
      );
    }

    let type_id = await account_helper.get_type_id("user_current");
    let account_exists = await account_helper.check_account_exists(
      address,
      type_id
    );
    let account_meta_exists = await account_helper.check_account_meta_exists(
      address
    );
    if (!account_exists.success) {
      return main_helper.error_response(res, account_exists);
    }
    console.log(account_exists, account_meta_exists);
    if (account_meta_exists.message == true) {
      let account_updated = await update_account_meta(
        address,
        name,
        email,
        mobile,
        date_of_birth,
        nationality,
        avatar
      );
      console.log(account_updated);

      if (account_updated.success) {
        await account_helper.check_and_send_verification_email(address, email);
        return main_helper.success_response(res, account_updated);
      }
    } else {
      let account_saved = await save_account_meta(
        address,
        name,
        email,
        mobile,
        date_of_birth,
        nationality,
        avatar
      );

      if (account_saved.success) {
        await account_helper.check_and_send_verification_email(address, email);
        return main_helper.success_response(res, account_saved);
      }
    }

    return main_helper.error_response(res, "Error while saving");
  } catch (e) {
    return main_helper.error_response(
      res,
      main_helper.error_message(e.message)
    );
  }
}
// verification code
async function verify(req, res) {
  try {
    let { code } = req.body;
    console.log(code);
    let verification = await verified_emails.findOne({
      verification_code: code,
    });
    console.log(verification);
    if (verification) {
      await verified_emails.findOneAndUpdate(
        { verification_code: code },
        {
          verified_at: Date.now(),
          verified: true,
        }
      );
      await account_meta.findOneAndUpdate(
        { address: verification.address },
        { email: verification.email }
      );

      return main_helper.success_response(res, "verified");
    }
    return main_helper.error_response(res, "verification failed");
  } catch (e) {
    return main_helper.error_response(res, "verification failed");
  }
}
// saving already checked profile meta data
async function save_account_meta(
  address,
  name,
  email,
  mobile,
  date_of_birth,
  nationality,
  avatar
) {
  try {
    let data = {
      address: address,
      name: name,
      mobile: mobile,
      date_of_birth: new Date(date_of_birth),
      nationality: nationality,
      avatar: avatar,
    };
    let save_user = await account_meta.create(data);
    if (save_user) {
      return main_helper.success_message("User meta saved");
    }
    return main_helper.error_message("Error while saving user meta");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
// saving already checked profile meta data
async function update_account_meta(
  address,
  name,
  email,
  mobile,
  date_of_birth,
  nationality,
  avatar
) {
  try {
    let data = {
      address: address,
      name: name,
      mobile: mobile,
      date_of_birth: new Date(date_of_birth),
      nationality: nationality,
      avatar: avatar,
    };
    let user = await account_meta.findOne({ address: address });
    if (email != user.email) {
      data.email_verified_at = null;
    }
    let save_user = await account_meta.findOneAndUpdate(data);
    if (save_user) {
      return main_helper.success_message({ save_user });
    }

    return main_helper.error_message("Error while updating user meta");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

module.exports = {
  update_meta,
  verify,
};
