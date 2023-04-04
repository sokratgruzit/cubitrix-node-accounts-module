const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const {
  accounts,
  account_meta,
  account_loan,
  accounts_keys,
  account_auth,
  verified_emails,
} = require("@cubitrix/models");

const jwt = require("jsonwebtoken");
const web3_accounts = require("web3-eth-accounts");

const Web3 = require("web3");
const web3 = new Web3("https://data-seed-prebsc-1-s1.binance.org:8545");

const WBNB = require("../abi/WBNB.json");
const STACK_ABI = require("../abi/stack.json");

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

    if (found.otp_enabled)
      return main_helper.success_response(res, {
        message: "proceed 2fa",
        address: account.address,
      });

    const token = jwt.sign({ address: account.address, email: email }, "jwt_secret", {
      expiresIn: "24h",
    });
    res.cookie("Access-Token", token, {
      sameSite: "none",
      httpOnly: true,
      secure: true,
    });
    return main_helper.success_response(res, {
      message: "access granted",
      address: account.address,
    });
  }

  main_helper.error_response(res, "no password found");
}

// logic of logging in
async function login_account(req, res) {
  try {
    let { address } = req.body;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("Fill all fields"),
      );
    }
    address = address.toLowerCase();

    const typeResults = await Promise.all([
      account_helper.get_type_id("external"),
      account_helper.get_type_id("system"),
    ]);

    let type_id = typeResults[0];
    let type_id_system = typeResults[1];

    let account_exists = await account_helper.check_account_exists(address, type_id);

    if (account_exists.success) {
      return main_helper.success_response(res, account_exists);
    }

    const accountSaved = await save_account(
      address.toLowerCase(),
      type_id,
      0,
      "external",
      "",
    );

    if (accountSaved.success) {
      const newAddress = await generate_new_address();

      await Promise.all([
        save_account(newAddress.toLowerCase(), type_id_system, 0, "system", address),
        account_auth.create({ address }),
        account_meta.create({ address }),
      ]);
    }

    return main_helper.success_response(res, "success");
  } catch (e) {
    return main_helper.error_response(res, main_helper.error_message(e?.message));
  }
}
// create different accounts like loan,
async function create_different_accounts(req, res) {
  try {
    let { address, type } = req.body;

    address = address.toLowerCase();

    if (address == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("missing some fields"),
      );
    }

    let type_id = await account_helper.get_type_id(type);
    // let account_exists = await account_helper.check_account_exists(address, type_id);

    let account_exists = await accounts.findOne({
      account_owner: address,
      account_type_id: type_id,
    });

    if (account_exists) {
      return main_helper.success_response(res, {
        message: "user already exists",
        data: account_exists,
      });
    }
    let account_web3 = new web3_accounts(
      "https://mainnet.infura.io/v3/cbf4ab3d4878468f9bbb6ff7d761b985",
    );
    let create_account = account_web3.create();
    let created_address = create_account.address;
    await accounts_keys.create({
      address: created_address,
      object_value: create_account,
    });
    let account_saved = await save_account(
      created_address.toLowerCase(),
      type_id,
      0,
      type,
      address,
    );

    res.status(200).send({ message: "account opened", data: account_saved });
  } catch (e) {
    console.log(e.message);
  }
}
// saving account in db
async function save_account(address, type_id, balance, account_category, account_owner) {
  address = address.toLowerCase();
  try {
    let save_user = await accounts.create({
      address: address,
      account_type_id: type_id,
      balance: Number(balance),
      account_category: account_category,
      account_owner: account_owner,
      active: true,
    });

    if (save_user) {
      return main_helper.success_message("User saved");
    }

    return main_helper.error_message("Error while saving user");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

// async function open_utility_accounts(req, res) {
//   try {
//     let { address, accountType } = req.body;
//     if (!address) {
//       return main_helper.success_response(res, { message: "address is required" });
//     }
//     address = address.toLowerCase();

//     if (!accountType) {
//       return main_helper.success_response(res, { message: "account type is required" });
//     }

//     let mainAccountType;
//     if (accountType === "loan") {
//       mainAccountType = account_loan;
//       console.log(mainAccountType, account_loan);
//     } else {
//       return main_helper.success_response(res, { message: "account type is not valid" });
//     }

//     const newAddress = await generate_new_address();

//     const foundAccount = await mainAccountType.findOne({ account_owner: address });

//     if (foundAccount) {
//       return main_helper.success_response(res, { message: "Account already opened" });
//     }

//     const openedAccount = await mainAccountType.create({
//       address: newAddress,
//       account_owner: address,
//       balance: 0,
//     });

//     return main_helper.success_response(res, {
//       message: "Account opened successfully",
//       data: openedAccount,
//     });
//   } catch (e) {
//     console.log(e.message);
//     return main_helper.error_response(res, {
//       message: "could not open account try later",
//     });
//   }
// }

async function generate_new_address() {
  let account_web3 = new web3_accounts(
    "https://mainnet.infura.io/v3/cbf4ab3d4878468f9bbb6ff7d761b985",
  );
  let create_account = account_web3.create();
  let created_address = create_account.address;
  await accounts_keys.create({
    address: created_address,
    object_value: create_account,
  });
  return created_address;
}

async function update_auth_account_password(req, res) {
  let { currentPassword, newPassword, address } = req.body;

  if (!address && req.auth?.address) {
    address = req.auth.address;
  }

  address = address.toLowerCase();

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
          if (!pass_match) return main_helper.error_response(res, "incorrect password");
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

    address = address.toLowerCase();

    let results = await accounts.aggregate([
      { $match: { address: address } },
      {
        $lookup: {
          from: "account_metas",
          localField: "address",
          foreignField: "address",
          as: "meta",
        },
      },
      {
        $lookup: {
          from: "accounts",
          localField: "address",
          foreignField: "account_owner",
          as: "system",
        },
      },
    ]);

    const auth_acc = await account_auth.findOne({ address: address });
    if (results[0]) {
      results[0].hasPasswordSet = auth_acc?.password ? true : false;
      results[0].otp_enabled = auth_acc?.otp_enabled;
      results[0].otp_verified = auth_acc?.otp_verified;
    }

    res.status(200).json(
      main_helper.return_data({
        status: true,
        data: { accounts: results },
      }),
    );
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error getting accounts");
  }
}

async function activate_account_via_staking(req, res) {
  try {
    let { address } = req.body;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("missing some fields"),
      );
    }

    address = address.toLowerCase();

    const account = await accounts.findOne({ address: address });

    if (!account) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    const updatedSystemAccount = await accounts.findOneAndUpdate(
      { account_owner: address },
      { active: true },
      { new: true },
    );

    if (!updatedSystemAccount) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    return main_helper.success_response(res, "account activated");
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error getting accounts");
  }
}

async function activate_account(req, res) {
  try {
    let { address } = req.body;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("missing some fields"),
      );
    }
    address = address.toLowerCase();

    const account = await accounts.findOne({ account_owner: address });

    if (!account) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    const tokenAddress = "0xd472C9aFa90046d42c00586265A3F62745c927c0"; // Staking contract Address

    const tokenContract = new web3.eth.Contract(STACK_ABI, tokenAddress);

    let condition = true;
    let loopCount = -1;
    let newestAccount = account;
    while (condition) {
      loopCount++;
      const result = await tokenContract.methods.stakersRecord(address, loopCount).call();

      if (result.staketime == 0) {
        condition = false;
        break;
      }

      if (
        newestAccount.staked.length === 0 ||
        !newestAccount.staked.some((item) => item.staketime === result.staketime)
      ) {
        newestAccount = await accounts.findOneAndUpdate(
          { account_owner: address },
          {
            active: true,
            $inc: { balance: result.amount / 10 ** 18 },
            $push: {
              staked: {
                staketime: result.staketime,
                amount: result.amount / 10 ** 18,
                added: true,
              },
            },
          },
          { new: true },
        );
      }
    }

    return main_helper.success_response(res, {
      message: "success",
      account: newestAccount,
    });
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error updating accounts");
  }
}

async function manage_extensions(req, res) {
  try {
    let { address, extensions } = req.body;

    if (!address || !extensions) {
      return main_helper.error_response(
        res,
        main_helper.error_message("missing some fields"),
      );
    }

    address = address.toLowerCase();

    const account = await accounts.findOne({ address: address });

    if (!account) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    const updateObj = {};

    for (const [key, value] of Object.entries(extensions)) {
      updateObj[`extensions.${key}`] = value;
    }

    const updatedAccount = await accounts.findOneAndUpdate(
      { address: address },
      { $set: updateObj },
      { new: true },
    );

    return main_helper.success_response(res, {
      message: "success",
      account: updatedAccount,
    });
  } catch (e) {
    console.log(e.message);
    return main_helper.error_response(res, "error updating accounts");
  }
}

module.exports = {
  index,
  login_account,
  login_with_email,
  get_account,
  update_auth_account_password,
  create_different_accounts,
  activate_account_via_staking,
  activate_account,
  manage_extensions,
  // open_utility_accounts,
};
