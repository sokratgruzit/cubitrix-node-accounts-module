const { account_meta, verified_emails } = require("@cubitrix/models");
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

    let account_meta_exists = await account_meta.findOne({
      address,
    });

    if (account_meta_exists) {
      if (account_meta_exists.email && account_meta_exists?.email === email) {
        await account_meta_exists.updateOne({
          address,
          name,
          email,
          mobile,
          date_of_birth,
          nationality,
          avatar,
        });
        return main_helper.success_response(res, "account updated");
      } else {
        if (account_meta_exists.email && account_meta_exists?.email !== email) {
          await verified_emails.deleteMany({ address });
          await account_meta_exists.updateOne({
            address,
            name,
            mobile,
            email: "",
            date_of_birth,
            nationality,
            avatar,
          });
        } else {
          await account_meta_exists.updateOne({
            address,
            name,
            mobile,
            date_of_birth,
            nationality,
            avatar,
          });
        }

        const response = await account_helper.check_and_send_verification_email(
          address,
          email
        );
        return main_helper.success_response(res, response);
      }
    } else {
      let account_saved = await save_account_meta(
        address,
        name,
        mobile,
        new Date(date_of_birth),
        nationality,
        avatar
      );

      if (account_saved.success) {
        const response = await account_helper.check_and_send_verification_email(
          address,
          email
        );
        return main_helper.success_response(res, response);
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
    let verification = await verified_emails.findOne({
      verification_code: code,
    });

    if (verification) {
      await verified_emails.findOneAndUpdate(
        { verification_code: code },
        {
          verified_at: Date.now(),
          verified: true,
        }
      );
      await verified_emails.deleteMany({
        address: verification.address,
        verified: false,
      });
      await account_meta.findOneAndUpdate(
        { address: verification.address },
        { email: verification.email }
      );

      return main_helper.success_response(res, {
        success: true,
      });
    }
    return main_helper.error_response(res, {
      success: false,
    });
  } catch (e) {
    return main_helper.error_response(res, {
      success: false,
    });
  }
}
// saving already checked profile meta data
async function save_account_meta(
  address,
  name,
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

module.exports = {
  update_meta,
  verify,
};
