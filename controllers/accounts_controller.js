const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const {
  accounts,
  account_meta,
  account_auth,
  verified_emails,
} = require("@cubitrix/models");
const jwt = require("jsonwebtoken");
const web3_accounts = require("web3-eth-accounts");

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

  const found = await account_auth.findOne({ address: account.address });
  if (!found) {
    return main_helper.error_response(res, "account not found");
  }
  if (found.password) {
    const pass_match = await found.match_password(password);
    if (!pass_match)
      return main_helper.error_response(res, "incorrect password");
    const token = jwt.sign(
      { address: account.address, email: email },
      "jwt_secret",
      {
        expiresIn: "24h",
      }
    );
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
    let { address } = req.body;

    if (address == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("Fill all fields")
      );
    }
    address = address.toLowerCase();
    console.log("here");
    let type_id = await account_helper.get_type_id("user_current");
    let account_exists = await account_helper.check_account_exists(
      address,
      type_id
    );

    if (account_exists.success) {
      return main_helper.success_response(res, account_exists);
    }
    let account_saved = await save_account(address, type_id, 0, "user", "");
    let account_meta_data = await account_meta.findOne({ address: address });

    if (account_meta_data && account_meta_data.email) {
      let verified = await verified_emails.findOne({
        address: address,
        email: account_meta_data.email,
      });
      if (verified && verified.verified) {
        await account_auth.create({ address });
      }
    }
    console.log(account_saved);
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
// create different accounts like loan,
async function create_different_accounts(req, res) {
  try {
    let { address, type } = req.body;

    if (address == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("missing some fields")
      );
    }

    let type_id = await account_helper.get_type_id(type);
    let account_exists = await account_helper.check_account_exists(
      address,
      type_id
    );

    if (account_exists.success) {
      return main_helper.success_response(res, account_exists);
    }
    let account = new web3_accounts(
      "https://mainnet.infura.io/v3/cbf4ab3d4878468f9bbb6ff7d761b985"
    );
    let create_account = account.create();
    let account_saved = await save_account(
      account_saved.address,
      type_id,
      0,
      type,
      address
    );

    res.send(create_account);
  } catch (e) {
    console.log(e.message);
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
      account_category: account_category,
      account_owner: account_owner,
    });

    await account_auth.create({
      address,
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
  let { currentPassword, newPassword, address } = req.body;

  if (!address && req.auth?.address) {
    address = req.auth.address;
  }

  let account_meta_data = await account_meta.findOne({ address: address });
  if (account_meta_data && account_meta_data.email) {
    let verified = await verified_emails.findOne({
      address: address,
      email: account_meta_data.email,
      verified: true,
    });

    if (verified && verified.verified) {
      account_auth.findOne({ address }, async function (err, user) {
        if (err || !user) {
          await account_auth.create({ address, password: newPassword });
          return main_helper.success_response(res, "created");
        }
        if (user.password) {
          const pass_match = await user.match_password(currentPassword);
          if (!pass_match)
            return main_helper.error_response(res, "incorrect password");
        }
        await user.updateOne({ password: newPassword });
        return main_helper.success_response(res, "password updated");
      });
    } else {
      return main_helper.error_response(res, "email unverified");
    }
  } else {
    return main_helper.error_response(res, "please verify email");
  }
}

async function get_account(req, res) {
  try {
    let { address } = req.body;

    if (!address && req.auth?.address) {
      address = req.auth.address;
    }

    let results = await accounts.aggregate([
      { $match: { address: address.toLowerCase() } },
      {
        $lookup: {
          from: "account_metas",
          localField: "address",
          foreignField: "address",
          as: "meta",
        },
      },
    ]);

    const has_password = await account_auth.findOne({ address: address });
    if (results[0]) {
      results[0].hasPasswordSet = has_password?.password ? true : false;
    }

    res.status(200).json(
      main_helper.return_data({
        status: true,
        data: { accounts: results },
      })
    );
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error getting accounts");
  }
}

module.exports = {
  index,
  login_account,
  login_with_email,
  get_account,
  update_auth_account_password,
  create_different_accounts,
};
