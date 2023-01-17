const accounts = require("../../models/accounts/accounts");
const main_helper = require("../../helpers/index");
const account_helper = require("../../helpers/accounts");
const update_meta = require("./../accounts_meta_controller");

const account_meta = require("../../models/accounts/account_meta");
const account_auth = require("../../models/accounts/account_auth");

const jwt = require("jsonwebtoken");

require("dotenv").config();
// get all accounts
async function get_accounts(req, res) {
  try {
    let accounts = await accounts.find();
    return main_helper.return_data({
      status: true,
      data: { accounts: accounts },
    });
  } catch (e) {
    return main_helper.error_response(res, "error getting accounts");
  }
}
module.exports = {
  get_accounts,
};
