const accounts = require("../models/accounts/accounts");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const update_meta = require("./accounts_meta_controller");

const account_meta = require("../models/accounts/account_meta");
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
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  const found = await account_auth.findOne({ address: account.address });
  if (!found) {
    return main_helper.error_response(res, "account not found");
  }
  if (found.password) {
    const pass_match = await found.match_password(password);
    if (!pass_match) return main_helper.error_response(res, "incorrect password");
    const token = jwt.sign({ address: account.address, email: email }, "jwt_secret", {
      expiresIn: "24h",
    });
    res.cookie("Access-Token", token, {
      sameSite: "none",
      httpOnly: true,
      secure: true,
    });
    return main_helper.success_response(res, "access granted");
  }

  main_helper.error_response(res, "no password found");
}

// logic of logging in
async function login_account(req, res) {
  try {
    let { address, balance } = req.body;

    if (address == undefined || balance == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("Fill all fields"),
      );
    }

    let type_id = await account_helper.get_type_id("user_current");
    let account_exists = await account_helper.check_account_exists(address, type_id);

    if (account_exists.success) {
      return main_helper.success_response(res, account_exists);
    }
    let account_saved = await save_account(address, type_id, balance, "user", "");
    await account_auth.create({ address });

    if (account_saved.success) {
      return main_helper.success_response(res, account_saved);
    }

    return main_helper.error_response(res, account_exists);
  } catch (e) {
    return main_helper.error_response(res, main_helper.error_message(e.message));
  }
}
// saving account in db
async function save_account(address, type_id, balance, account_category, account_owner) {
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

async function update_auth_account_password(req, res) {
  const { currentPassword, newPassword, address } = req.body;

  account_auth.findOne({ address }, async function (err, user) {
    if (err) {
      await account_auth.create({ address, password: newPassword });
      return main_helper.success_response(res, "created");
    }
    if (user.password) {
      const pass_match = await user.match_password(currentPassword);
      if (!pass_match) return main_helper.error_response(res, "incorrect password");
    }
    await user.updateOne({ password: newPassword });
    return main_helper.success_response(res, "password updated");
  });
}

module.exports = {
  index,
  login_account,
  login_with_email,
  update_auth_account_password,
};
