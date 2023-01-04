const accounts = require("../models/accounts/accounts");
const account_meta = require("../models/accounts/account_meta");
const account_auth = require("../models/accounts/account_auth");
const account_types = require("../models/accounts/account_types");
const main_helper = require("../helpers/index");
require("dotenv").config();

// test function that returns name
function index(name) {
  return name;
}
// logic of logging in
async function login_account(req, res) {
  try {
    let { address, balance } = req.body;
    if (address == undefined || balance == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("fill all fields")
      );
    }
    let type_id = await get_type_id("user_current");
    let account_exists = await check_account_exists(address, type_id);
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
        main_helper.error_message("fill all fields")
      );
    }
    let type_id = await get_type_id("user_current");
    let account_exists = await check_account_exists(address, type_id);
    let account_meta_exists = await check_account_meta_exists(address);
    if (!account_exists.success) {
      return main_helper.error_response(res, account_exists);
    }
    console.log(account_meta_exists);
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
      console.log(account_saved);
      if (account_saved.success) {
        return main_helper.success_response(res, account_saved);
      }
    }

    return main_helper.error_response(res, "error while saving");
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
    console.log(save_user);
    if (save_user) {
      return main_helper.success_message("user meta saved");
    }
    return main_helper.error_message("error while saving user meta");
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
      return main_helper.success_message("user meta updated");
    }
    return main_helper.error_message("error while updating user meta");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
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
      return main_helper.success_message("user saved");
    }
    return main_helper.error_message("error while saving user");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}
//  getting type id from db
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
// method to check ig account already exists in db
async function check_account_exists(address, type_id) {
  try {
    let account = await accounts.findOne({
      address: address,
      account_type_id: type_id,
    });
    if (account && account?.address) {
      return main_helper.success_message("account found");
    } else {
      return main_helper.error_message("account not Found");
    }
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

module.exports = {
  index,
  login_account,
  update_meta,
};
