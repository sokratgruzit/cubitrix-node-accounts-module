const accounts = require("../models/accounts/accounts");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const account_auth = require("../models/accounts/account_auth");

const jwt = require("jsonwebtoken");

require("dotenv").config();

// test function that returns name
function index(name) {
  return name;
}

// login with email for account recovery
async function login_with_email(req, res) {
  let { email, password } = req.body;

  const account = await account_meta.findOne({ email });
  if (!account) {
    return main_helper.error_response(
      res,
      "Token is invalid or user doesn't exist"
    );
  }

  const account_auth = await account_auth.findOne({ address: account.address });

  const passwordMatch = await account_auth.match_password(password);

  if (!passwordMatch) {
    return main_helper.error_response(res, "Incorrect password");
  }

  const accessToken = jwt.sign({ address: account, address }, "jwt_secret", {
    expiresIn: "24hm",
  });

  try {
    let otp_enabled = account.otp_enabled;
    return main_helper.success_response(res, otp_enabled, accessToken);
  } catch (e) {
    return main_helper.error_response(res, "Error while validate user");
  }
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
    await account_auth.create({ address });

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
};
