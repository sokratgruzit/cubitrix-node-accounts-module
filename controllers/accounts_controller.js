const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const {
  accounts,
  account_meta,
  account_auth,
  rates,
  account_balances,
  accounts_keys,
  verified_emails,
  options,
  stakes,
} = require("@cubitrix/models");

const {
  create_deposit_transaction,
} = require("@cubitrix/cubitrix-node-transactions-module");

const axios = require("axios");

const jwt = require("jsonwebtoken");
const web3_accounts = require("web3-eth-accounts");

const Web3 = require("web3");
const web3 = new Web3("https://data-seed-prebsc-1-s1.binance.org:8545");

const WBNB = require("../abi/WBNB.json");
const STACK_ABI = require("../abi/stack.json");

const ObjectId = require("mongodb").ObjectId;

const { Mutex } = require("async-mutex");

const mutexes = {};

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

    let account_exists = await accounts.findOne({
      address: address,
      account_category: "external",
    });

    if (account_exists) {
      return main_helper.success_response(res, "account already exists");
    }

    let createdAcc = await accounts.create({
      address: address.toLowerCase(),
      account_category: "external",
      account_owner: "",
      active: true,
    });

    if (createdAcc) {
      const newAddressMain = await generate_new_address();
      const newAddressSystem = await generate_new_address();

      await Promise.all([
        await accounts.create({
          address: newAddressMain.toLowerCase(),
          balance: 0,
          account_category: "main",
          account_owner: address,
          active: false,
          step: 2,
        }),
        await accounts.create({
          address: newAddressSystem.toLowerCase(),
          account_category: "system",
          account_owner: address,
        }),
        account_auth.create({ address }),
        account_meta.create({ address }),
      ]);
    }

    return main_helper.success_response(res, "success");
  } catch (e) {
    return main_helper.error_response(res, main_helper.error_message(e?.message));
  }
}

async function handle_step(req, res) {
  try {
    let { address, step, active } = req.body;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("Fill all fields"),
      );
    }
    address = address.toLowerCase();

    const mainAccount = await accounts.findOne({
      account_owner: address,
      account_category: "main",
    });

    if (!mainAccount) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    const updatedMainAccount = await accounts.findOneAndUpdate(
      { account_owner: address, account_category: "main" },
      { step, active },
      { new: true },
    );

    return main_helper.success_response(res, {
      message: "success",
      account: updatedMainAccount,
    });
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "something went wrong");
  }
}

// create different accounts like loan,
async function create_different_accounts(req, res) {
  try {
    let { address, type } = req.body;

    if (address == undefined) {
      return main_helper.error_response(
        res,
        main_helper.error_message("missing some fields"),
      );
    }
    address = address.toLowerCase();

    let option = await options.findOne({ key: "extension_options" });

    let fee;

    if (type === "loan") fee = option.object_value.loan_extensions_fee;
    if (type === "trade") fee = option.object_value.trade_extensions_fee;

    fee = parseInt(fee);

    if (isNaN(fee)) {
      return main_helper.error_response(res, {
        message: "fee must be a real number",
        data: account_exists,
      });
    }

    let account_exists = await accounts.findOne({
      account_owner: address,
      account_category: type,
    });

    if (account_exists) {
      return main_helper.error_response(res, {
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

    let account_saved = await accounts.create({
      address: created_address.toLowerCase(),
      balance: 0,
      account_category: type,
      account_owner: address,
      active: true,
    });

    if (account_saved) {
      await accounts.findOneAndUpdate(
        { account_owner: address, account_category: "main" },
        { $inc: { balance: -fee } },
      );
    }

    res.status(200).send({ message: "account opened", data: account_saved });
  } catch (e) {
    console.log(e.message);
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

  if (created_address) created_address = created_address.toLowerCase();
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
      { $match: { account_owner: address, account_category: "main" } },
      {
        $lookup: {
          from: "account_metas",
          localField: "account_owner",
          foreignField: "address",
          as: "meta",
        },
      },
      {
        $unwind: "$meta",
      },
      {
        $addFields: {
          meta_id_objectId: { $toObjectId: "$meta._id" },
        },
      },
      {
        $lookup: {
          from: "referral_uni_users",
          localField: "meta_id_objectId",
          foreignField: "user_id",
          as: "referral",
        },
      },
    ]);

    const auth_acc = await account_auth.findOne({ address: address });
    if (results[0]) {
      results[0].hasPasswordSet = auth_acc?.password ? true : false;
      results[0].otp_enabled = auth_acc?.otp_enabled;
      results[0].otp_verified = auth_acc?.otp_verified;
      results[0].stakedTotal = results[0].stakedTotal || 0; // Check if stakedTotal exists, otherwise set it to 0
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

    const updatedMainAccount = await accounts.findOneAndUpdate(
      { account_owner: address, account_category: "main" },
      { active: true },
      { new: true },
    );

    if (!updatedMainAccount) {
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

    let newestAcc = await accounts.findOne({
      account_owner: address,
      account_category: "main",
    });

    if (!newestAcc) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    const userStakes = await stakes.find({ address: address });

    const tokenAddress = "0xd472C9aFa90046d42c00586265A3F62745c927c0"; // Staking contract Address

    const tokenContract = new web3.eth.Contract(STACK_ABI, tokenAddress);

    let condition = true;
    let newestStakes = userStakes;
    let loopCount = userStakes.length - 1;

    if (mutexes[address]) {
      return main_helper.error_response(res, "account is currently being updated");
    }

    const mutex = mutexes[address] || new Mutex();
    mutexes[address] = mutex;
    await mutex.acquire();

    while (condition) {
      loopCount++;
      const result = await tokenContract.methods.stakersRecord(address, loopCount).call();
      if (result.staketime == 0) {
        condition = false;
        break;
      }

      if (
        (newestStakes.length === 0 ||
          !newestStakes.some((item) => item.staketime === result.staketime)) &&
        !result.unstaked
      ) {
        newestAcc = await accounts.findOne({
          account_owner: address,
          account_category: "main",
        });

        let updateObj = {};
        if (newestAcc?.tier?.value !== "basic") {
          let stakedAmount = result.amount / 10 ** 18;

          if (!newestAcc?.tier?.value) {
            updateObj.amount = stakedAmount;
            if (stakedAmount >= 100 && stakedAmount < 500) {
              updateObj.value = "basic";
            } else if (stakedAmount >= 5000 && stakedAmount < 20000) {
              updateObj.value = "gold";
            } else if (stakedAmount >= 20000 && stakedAmount < 100000) {
              updateObj.value = "diamond";
            } else if (stakedAmount > 100000) {
              updateObj.value = "vip";
            }
          } else {
            const newAmount = newestAcc?.tier?.amount + stakedAmount;
            updateObj.amount = newAmount;
            if (newAmount >= 5000 && newAmount < 20000) {
              updateObj.value = "gold";
            } else if (newAmount >= 20000 && newAmount < 100000) {
              updateObj.value = "diamond";
            } else if (newAmount > 100000) {
              updateObj.value = "vip";
            }
          }
        }

        const [createdStake] = await Promise.all([
          stakes.create({
            amount: result.amount / 10 ** 18,
            reward: result.reward / 10 ** 18,
            address: address,
            staketime: result.staketime,
            unstaketime: result.unstaketime,
          }),
          accounts.findOneAndUpdate(
            { account_owner: address, account_category: "main" },
            {
              $inc: {
                balance: result.amount / 10 ** 18,
                stakedThisMonth: result.amount / 10 ** 18,
                stakedToday: result.amount / 10 ** 18,
                stakedTotal: result.amount / 10 ** 18,
              },
              tier: updateObj,
            },
            { new: true },
          ),
          create_deposit_transaction(
            address,
            result.amount / 10 ** 18,
            "ether",
            "deposit",
          ),
        ]);

        newestStakes = [...newestStakes, createdStake];
      }
    }

    mutex.release();
    delete mutexes[address];

    return main_helper.success_response(res, {
      message: "success",
      account: newestAcc,
    });
  } catch (e) {
    console.log(e, "acc");
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

    const [accountMain, accountMeta] = await Promise.all([
      accounts.findOne({ account_owner: address, account_category: "main" }),
      account_meta.findOne({ address: address }),
    ]);

    if (!accountMain) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }

    if (!accountMeta.email) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not verified"),
      );
    }

    const updateObj = {};

    for (const [key, value] of Object.entries(extensions)) {
      if (accountMain.active) {
        if ((key === "trade" || key === "loan") && value === "true") {
          const accountExtension = await accounts.findOne({
            account_owner: address,
            account_category: key,
          });
          if (!accountExtension) {
            if (accountMain.balance > 2) {
              const newAddress = await generate_new_address();
              const [] = await Promise.all([
                accountMain.updateOne({ $inc: { balance: 0 - 2 } }),
                accounts.create({
                  address: newAddress.toLowerCase(),
                  balance: 0,
                  account_category: key,
                  account_owner: address,
                  active: true,
                }),
              ]);
              updateObj[`extensions.${key}`] = value;
            } else {
              return main_helper.error_response(
                res,
                main_helper.error_message("insufficient balance"),
              );
            }
          } else {
            updateObj[`extensions.${key}`] = value;
          }
        } else {
          updateObj[`extensions.${key}`] = value;
        }
      } else if (!accountMain.active) {
        if (["staking", "referral", "notify"].includes(key)) {
          updateObj[`extensions.${key}`] = value;
        }
      }
    }

    const updatedAccount = await accounts.findOneAndUpdate(
      { account_owner: address, account_category: "main" },
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

async function get_account_by_type(req, res) {
  try {
    let { address, type } = req.body;

    if (!address && req.auth?.address) {
      address = req.auth.address;
    }

    address = address.toLowerCase();

    if (!address || !type) {
      return main_helper.error_response(
        res,
        main_helper.error_message("address and type is required"),
      );
    }

    let account = await accounts.findOne({
      account_owner: address,
      account_category: type,
    });

    if (!account) {
      return main_helper.error_response(
        res,
        main_helper.error_message("account not found"),
      );
    }
    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error getting account");
  }
}

async function get_account_balances(req, res) {
  try {
    let { address } = req.body;

    if (!address && req.auth?.address) {
      address = req.auth.address;
    }

    address = address.toLowerCase();
    let accounts_data = await accounts.find(
      {
        $or: [{ account_owner: address }, { address: address }],
      },
      { _id: 0, address: 1, account_category: 1, assets: 1, balance: 1 },
    );
    return res.status(200).json({
      success: true,
      data: accounts_data,
    });

    // if (!account) {
    //   return main_helper.error_response(
    //     res,
    //     main_helper.error_message("account not found")
    //   );
    // }
    // res.status(200).json({
    //   success: true,
    //   data: account,
    // });
  } catch (e) {
    console.log(e, "get account balances");
    return main_helper.error_response(res, "error getting account");
  }
}

async function update_current_rates() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd",
    );
    const { bitcoin, ethereum, tether } = response.data;

    await rates.findOneAndUpdate(
      {},
      {
        btc: { usd: bitcoin.usd },
        eth: { usd: ethereum.usd },
        usdt: { usd: tether.usd },
      },
    );
  } catch (error) {
    console.error("Error fetching rates:", error);
  }
}

async function get_rates(req, res) {
  try {
    const ratesObj = await rates.findOne();
    res.status(200).json(ratesObj);
  } catch (e) {
    console.log(e);
    res.status(500).json("failed to get rates");
  }
}

module.exports = {
  index,
  login_account,
  login_with_email,
  get_account,
  get_account_by_type,
  update_auth_account_password,
  create_different_accounts,
  activate_account_via_staking,
  activate_account,
  manage_extensions,
  get_account_balances,
  handle_step,
  // open_utility_accounts,
  update_current_rates,
  get_rates,
};
