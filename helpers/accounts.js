const accounts = require("../models/accounts/accounts");
const account_meta = require("../models/accounts/account_meta");
const account_auth = require("../models/accounts/account_auth");
const account_types = require("../models/accounts/account_types");
const main_helper = require("../helpers/index");

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
// method to check ig account already exists in db
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

module.exports = {
  check_account_meta_exists,
  check_account_exists,
  get_type_id,
};
