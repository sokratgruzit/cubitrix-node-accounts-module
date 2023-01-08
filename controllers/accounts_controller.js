const accounts = require("../models/accounts/accounts");
const account_meta = require("../models/accounts/account_meta");
const account_auth = require("../models/accounts/account_auth");
const account_types = require("../models/accounts/account_types");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");

require("dotenv").config();

// test function that returns name
function index(name) {
  return name;
}

// login with email for account recovery
async function login_with_email(req, res) {
  let { address } = req.body;

  const account = await account_auth.findOne({ address });

  if (!account) {
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  if (account) {
    let otp_enabled = account.otp_enabled;

    return main_helper.success_response(res, otp_enabled);
  }

  return main_helper.error_response(res, "Error while validate user");
}

// logic of logging in
async function login_account(req, res) {
  try {
    let { address, balance } = req.body;

    if (address == undefined || balance == undefined) {
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

    if (account_exists.success) {
      return main_helper.success_response(res, account_exists);
    }

    let account_saved = await save_account(
      address,
      type_id,
      balance,
      "user",
      ""
    );

    if (account_saved.success) {
      return main_helper.success_response(res, account_saved);
    }

    return main_helper.error_response(res, account_exists);
  } catch (e) {
    return main_helper.error_response(
      res,
      main_helper.error_message(e.message)
    );
  }
}

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

      if (account_updated.success) {
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
    let save_user = await account_meta.create({
      address: address,
      name: name,
      email: email,
      mobile: mobile,
      date_of_birth: new Date(date_of_birth),
      nationality: nationality,
      avatar: avatar,
    });

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
    let save_user = await account_meta.findOneAndUpdate(
      { address: address },
      {
        address: address,
        name: name,
        email: email,
        mobile: mobile,
        date_of_birth: new Date(date_of_birth),
        nationality: nationality,
        avatar: avatar,
      }
    );

    if (save_user) {
      return main_helper.success_message("User meta updated");
    }

    return main_helper.error_message("Error while updating user meta");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

// saving account in db
async function save_account(
  address,
  type_id,
  balance,
  account_category,
  account_owner
) {
  try {
    let save_user = await accounts.create({
      address: address,
      account_type_id: type_id,
      balance: balance,
      account_category: account_category,
      account_owner: account_owner,
    });

    if (save_user) {
      return main_helper.success_message("User saved");
    }

    return main_helper.error_message("Error while saving user");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

module.exports = {
  index,
  login_account,
  login_with_email,
  update_meta,
};
