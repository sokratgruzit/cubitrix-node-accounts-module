const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const generate_token = require("../helpers/generate_token");
const {
  accounts,
  account_meta,
  account_auth,
  rates,
  accounts_keys,
  options,
  stakes,
  currencyStakes,
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

const refresh_token = async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) return res.status(401).json({ "message": "Unauthorized" });
  
  const refresh_token = cookies.jwt;
 
  const auth = await account_auth.find({ access_token });

  jwt.verify(
    refresh_token,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      if (err || auth[0]?.address !== decoded.address) {
        return res.status(403).json({ "message": "Forbidden" });
      }

      const access_token = generate_token(
        {
          address: decoded.address, 
          email: decoded.email
        },
        "access_token", 
        "30d"
      );
      
      res.json({ access_token });
    }
  )
};

// login with email for account recovery
async function login_with_email(req, res) {
  let { email, password } = req.body;

  const account = await account_meta.findOne({ email });
  const found = await account_auth.findOne({ address: account.address });
  
  if (!account) {
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  if (!found) {
    return main_helper.error_response(res, "account not found");
  }

  if (found.password) {
    const pass_match = await found.match_password(password);

    if (!pass_match) return main_helper.error_response(res, "incorrect password");

    const access_token = generate_token(
      account.address,
      email,
      "30d",
      "access_token"
    );

    // const refresh_token = generate_token(
    //   account.address,
    //   email,
    //   "30d",
    //   "refresh_token"
    // );

    await account_auth.updateOne(
      { address: account.address },
      {
        $set: {
          access_token: access_token,
        },
      }
    );

    res.cookie("Access-Token", access_token, {
      sameSite: "none",
      httpOnly: true,
      secure: true,
    });

    if (found.otp_enabled) {
      return main_helper.success_response(res, {
        message: "proceed 2fa",
        address: account.address,
      });
    }

    return main_helper.success_response(res, {
      message: "access granted",
      address: account.address,
    });
  }

  main_helper.error_response(res, "no password found");
}

// logic of logging in
const processingAccounts = {};
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

    if (processingAccounts[address]) {
      return main_helper.error_response(res, "Account processing, try again later");
    }
    processingAccounts[address] = true;

    let account_exists = await accounts.findOne({
      address: address,
      account_category: "external",
    });

    if (account_exists) {
      delete processingAccounts[address];
      return main_helper.success_response(res, "account already exists");
    }

    let createdAcc = await accounts.create({
      address: address,
      account_category: "external",
      account_owner: "",
      active: true,
    });

    if (createdAcc) {
      const [newAddressMain, newAddressSystem] = await Promise.all([
        generate_new_address(),
        generate_new_address(),
      ]);

      await Promise.all([
        accounts.create({
          address: newAddressMain.toLowerCase(),
          balance: 0,
          account_category: "main",
          account_owner: address,
          active: false,
          step: 2,
        }),
        accounts.create({
          address: newAddressSystem.toLowerCase(),
          account_category: "system",
          account_owner: address,
        }),
        account_auth.create({ address }),
        account_meta.create({ address }),
      ]);
    }

    delete processingAccounts[address]; // Release lock
    return main_helper.success_response(res, "success");
  } catch (e) {
    delete processingAccounts[address]; // Release lock in case of error
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
    if (account_meta_data.verified) {
      account_auth.findOne({ address }, async function (err, user) {
        if (err || !user) {
          await account_auth.create({ address, password: newPassword });
          return main_helper.success_response(res, "created");
        }

        if (user.password) {
          const pass_match = await user.match_password(currentPassword);
          if (!pass_match) return main_helper.error_response(res, "incorrect password");
        }

        await user.findOneupdateOne({ password: newPassword });
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

    let todayWithWiggle = Date.now() - 28 * 60 * 60 * 1000;
    let monthWithWiggle = Date.now() - 30 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000;

    let incrementMonthly = 0;
    let incrementDaily = 0;

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
        if (newestAcc?.tier?.value !== "Novice Navigator") {
          let stakedAmount = result.amount / 10 ** 18;

          if (!newestAcc?.tier?.value) {
            updateObj.amount = stakedAmount;
            if (stakedAmount <= 500) {
              updateObj.value = "Novice Navigator";
            } else if (stakedAmount >= 5000 && stakedAmount < 20000) {
              updateObj.value = "Stellar Standard";
            } else if (stakedAmount >= 20000 && stakedAmount < 100000) {
              updateObj.value = "Expert Edge";
            } else if (stakedAmount > 100000) {
              updateObj.value = "Platinum Privilege";
            }
          } else {
            const newAmount = newestAcc?.tier?.amount + stakedAmount;
            updateObj.amount = newAmount;
            if (newAmount >= 5000 && newAmount < 20000) {
              updateObj.value = "Stellar Standard";
            } else if (newAmount >= 20000 && newAmount < 100000) {
              updateObj.value = "Expert Edge";
            } else if (newAmount > 100000) {
              updateObj.value = "Platinum Privilege";
            }
          }
        }

        if (result.staketime * 1000 >= todayWithWiggle) {
          incrementDaily = result.amount / 10 ** 18;
        } else {
          incrementDaily = 0;
        }

        if (result.staketime * 1000 >= monthWithWiggle) {
          incrementMonthly = result.amount / 10 ** 18;
        } else {
          incrementMonthly = 0;
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
                stakedThisMonth: incrementMonthly,
                stakedToday: incrementDaily,
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
          accounts.findOneAndUpdate(
            {
              account_owner: address,
              account_category: "trade",
            },
            {
              $inc: {
                balance: result.amount / 10 ** 18,
              },
            },
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

// async function manage_extensions(req, res) {
//   try {
//     let { address, extensions } = req.body;

//     if (!address || !extensions) {
//       return main_helper.error_response(
//         res,
//         main_helper.error_message("missing some fields"),
//       );
//     }

//     address = address.toLowerCase();

//     const [accountMain, accountMeta] = await Promise.all([
//       accounts.findOne({ account_owner: address, account_category: "main" }),
//       account_meta.findOne({ address: address }),
//     ]);

//     if (!accountMain) {
//       return main_helper.error_response(
//         res,
//         main_helper.error_message("account not found"),
//       );
//     }

//     if (!accountMeta.email) {
//       return main_helper.error_response(
//         res,
//         main_helper.error_message("account not verified"),
//       );
//     }

//     const updateObj = {};

//     for (const [key, value] of Object.entries(extensions)) {
//       if (accountMain.active) {
//         const accountExtension = await accounts.findOne({
//           account_owner: address,
//           account_category: key,
//         });

//         if (key === "loan" && value === "true" && !accountExtension) {
//           if (accountMain.balance > 2) {
//             const newAddress = await generate_new_address();
//             const [] = await Promise.all([
//               accountMain.updateOne({ $inc: { balance: 0 - 2 } }),
//               accounts.create({
//                 address: newAddress.toLowerCase(),
//                 balance: 0,
//                 account_category: key,
//                 account_owner: address,
//                 active: true,
//               }),
//             ]);
//             updateObj[`extensions.${key}`] = value;
//           } else {
//             return main_helper.error_response(
//               res,
//               main_helper.error_message("insufficient balance"),
//             );
//           }
//         } else if (key === "trade" && value === "true" && !accountExtension) {
//           const newAddress = await generate_new_address();
//           await accounts.create({
//             address: newAddress.toLowerCase(),
//             balance: 0,
//             account_category: key,
//             account_owner: address,
//             active: true,
//           });
//           updateObj[`extensions.${key}`] = value;
//         } else {
//           updateObj[`extensions.${key}`] = value;
//         }
//       } else if (!accountMain.active) {
//         if (["staking", "referral", "notify"].includes(key)) {
//           updateObj[`extensions.${key}`] = value;
//         }
//       }
//     }

//     const updatedAccount = await accounts.findOneAndUpdate(
//       { account_owner: address, account_category: "main" },
//       { $set: updateObj },
//       { new: true },
//     );

//     return main_helper.success_response(res, {
//       message: "success",
//       account: updatedAccount,
//     });
//   } catch (e) {
//     console.log(e.message);
//     return main_helper.error_response(res, "error updating accounts");
//   }
// }

async function manage_extensions(req, res) {
  try {
    let { address, extensions, setup } = req.body;

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
      if (setup) {
        if (key === "trade" && value === "true") {
          const accountExtension = await accounts.findOne({
            account_owner: address,
            account_category: key,
          });
          if (!accountExtension) {
            const newAddress = await generate_new_address();
            const [] = await Promise.all([
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
            updateObj[`extensions.${key}`] = value;
          }
        } else {
          updateObj[`extensions.${key}`] = value;
        }
      } else if (accountMain.active) {
        if (key === "loan" && value === "true") {
          const accountExtension = await accounts.findOne({
            account_owner: address,
            account_category: key,
          });
          if (!accountExtension) {
            const newAddress = await generate_new_address();
            const [] = await Promise.all([
              accounts.create({
                address: newAddress.toLowerCase(),
                balance: 0,
                account_category: key,
                account_owner: address,
                active: true,
              }),
            ]);
            updateObj[`extensions.${key}`] = value;
            // if (accountMain.balance > 2) {
            //   const newAddress = await generate_new_address();
            //   const [] = await Promise.all([
            //     // accountMain.updateOne({ $inc: { balance: 0 - 2 } }),
            //     accounts.create({
            //       address: newAddress.toLowerCase(),
            //       balance: 0,
            //       account_category: key,
            //       account_owner: address,
            //       active: true,
            //     }),
            //   ]);
            //   updateObj[`extensions.${key}`] = value;
            // } else {
            //   return main_helper.error_response(
            //     res,
            //     main_helper.error_message("insufficient balance"),
            //   );
            // }
          } else {
            updateObj[`extensions.${key}`] = value;
          }
        } else {
          updateObj[`extensions.${key}`] = value;
        }
      } else if (!accountMain.active) {
        if (["staking", "notify"].includes(key)) {
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
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin&vs_currencies=usd",
    );
    const { bitcoin, ethereum } = response.data;

    await rates.findOneAndUpdate(
      {},
      {
        btc: { usd: bitcoin.usd },
        eth: { usd: ethereum.usd },
        usdc: { usd: response.data?.["usd-coin"]?.usd },
        gold: { usd: 1961 },
        platinum: { usd: 966 },
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

async function get_recepient_name(req, res) {
  try {
    let { address } = req.body;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("address is required"),
      );
    }

    if (address?.length < 42) {
      return main_helper.error_response(
        res,
        main_helper.error_message("address is not valid"),
      );
    }

    address = address.toLowerCase();

    const userAccount = await account_meta.findOne({ address });

    if (!userAccount) {
      return main_helper.error_response(
        res,
        main_helper.error_message("No such account exists"),
      );
    }
    return main_helper.success_response(res, {
      message: "success",
      name: hideName(userAccount?.name ?? ""),
    });
  } catch (e) {
    console.log(e, "error getting recepient name");
    res.status(500).json("failed to get recepient name");
  }
}

function hideName(name) {
  if (name?.length <= 2) {
    return name;
  }

  const firstLetter = name?.charAt(0);
  const lastLetter = name?.charAt(name?.length - 1);
  const middleAsterisks = "*".repeat(name?.length - 2);

  return firstLetter + middleAsterisks + lastLetter;
}

async function stakeCurrency(req, res) {
  try {
    const { address: addr, amount, currency, percentage = 0, duration } = req.body;

    if (!addr || !amount || !currency) {
      return main_helper.error_response(
        res,
        "address, amount, and currency are required",
      );
    }

    const address = addr.toLowerCase();

    const mainAccount = await accounts.findOne({
      account_owner: address,
      account_category: "main",
    });

    if (!mainAccount) {
      return main_helper.error_response(res, "account not found");
    }

    if (mainAccount.assets[currency] < Number(amount)) {
      return main_helper.error_response(res, "insufficient balance");
    }

    let expires;
    if (duration === "360 D") {
      expires = Date.now() + 360 * 24 * 60 * 60 * 1000;
    }

    const updateAccountPromise = accounts.findOneAndUpdate(
      { account_owner: address, account_category: "main" },
      {
        $inc: {
          [`assets.${currency}Staked`]: Number(amount),
          [`assets.${currency}`]: -Number(amount),
        },
      },
      { new: true },
    );

    const createStakePromise = currencyStakes.create({
      address,
      amount: Number(amount),
      currency,
      percentage,
      expires,
    });

    const [updatedAccount, createdStake] = await Promise.all([
      updateAccountPromise,
      createStakePromise,
    ]);

    if (!createdStake) {
      return main_helper.error_response(res, "error staking currency");
    }

    return main_helper.success_response(res, updatedAccount);
  } catch (e) {
    console.log(e, "error staking currency");
    return main_helper.error_response(res, "error staking currency");
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
  get_recepient_name,
  stakeCurrency,
  refresh_token
};
