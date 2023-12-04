const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
const {
  accounts,
  account_meta,
  account_auth,
  rates,
  accounts_keys,
  options,
  stakes,
} = require("@cubitrix/models");

require("dotenv").config();

const {
  create_deposit_transaction,
} = require("@cubitrix/cubitrix-node-transactions-module");

const axios = require("axios");

const jwt = require("jsonwebtoken");
const web3_accounts = require("web3-eth-accounts");

const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER_URL);

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

async function login_with_email(req, res) {
  let { email, password } = req.body;
  let check_email = await account_helper.check_email_on_company(email);
  if (!check_email) {
    return main_helper.error_response(res, "Email isnot correct");
  }
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

    const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    await update_login_data(account.address, ipAddress);

    if (found.otp_enabled)
      return main_helper.success_response(res, {
        message: "proceed 2fa",
        address: account.address,
      });
    const mainAcc = await accounts.findOne({
      account_owner: account.address,
      account_category: "main",
    });
    const accessToken = jwt.sign(
      { address: account.address, mainAddress: mainAcc?.address },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    const refreshToken = jwt.sign(
      { address: account.address, mainAddress: mainAcc?.address },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      },
    );

    res.cookie("Access-Token", accessToken, {
      sameSite: "none",
      httpOnly: true,
      secure: true,
    });

    res.cookie("Refresh-Token", refreshToken, {
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

const processingAccounts = {};
async function web3Connect(req, res) {
  let { signature, address } = req.body;

  if (!signature || !address) return main_helper.error_response(res, "missing fields");
  address = address.toLowerCase();

  try {
    if (processingAccounts[address]) {
      return main_helper.error_response(res, "Account processing, try again later");
    }
    processingAccounts[address] = true;

    address = address.toLowerCase();

    let message = "I confirm that this is my address";

    let recoveredAddress = web3.eth.accounts.recover(message, signature);
    const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (recoveredAddress.toLowerCase() === address) {
      await update_login_data(address, ipAddress);

      const mainAccFirst = await accounts.findOne({
        account_owner: address,
        account_category: "main",
      });

      if (!mainAccFirst) {
        const [newAddressMain, newAddressSystem, newTradeAddress] = await Promise.all([
          generate_new_address(),
          generate_new_address(),
          generate_new_address(),
        ]);

        await Promise.all([
          accounts.create({
            address: address,
            account_category: "external",
            account_owner: "",
            active: true,
          }),
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
          accounts.create({
            address: newTradeAddress.toLowerCase(),
            balance: 0,
            account_category: "trade",
            account_owner: address,
            active: true,
          }),
          account_auth.create({ address }),
          account_meta.create({ address }),
        ]);
      }
      let mainAcc = mainAccFirst;
      if (!mainAcc) {
        mainAcc = await accounts.findOne({
          account_owner: address,
          account_category: "main",
        });
      }

      const accessToken = jwt.sign(
        { address: address, mainAddress: mainAcc?.address },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        },
      );

      const refreshToken = jwt.sign(
        { address: address, mainAddress: mainAcc?.address },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        },
      );

      res.cookie("Access-Token", accessToken, {
        sameSite: "none",
        httpOnly: true,
        secure: true,
      });

      res.cookie("Refresh-Token", refreshToken, {
        sameSite: "none",
        httpOnly: true,
        secure: true,
      });

      if (processingAccounts[address]) {
        delete processingAccounts[address];
      }

      return res.status(200).send("Connected");
    }

    if (processingAccounts[address]) {
      delete processingAccounts[address];
    }

    return res.status(401).send("Invalid signature");
  } catch (error) {
    if (processingAccounts[address]) {
      delete processingAccounts[address];
    }
    console.log(error);
  }
}

async function handle_step(req, res) {
  try {
    let { step, active } = req.body;
    let address = req.address;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("You are not logged in"),
      );
    }

    const mainAccount = await accounts.findOne({
      account_owner: address,
      account_category: "main",
    });

    if (!mainAccount) {
      return main_helper.error_response(
        res,
        main_helper.error_message("Account not found"),
      );
    }

    const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    let ipAddresses = mainAccount.ips ?? [];
    if (!ipAddresses.includes(ipAddress)) {
      ipAddresses.push(ipAddress);
      await accounts.findOneAndUpdate(
        {
          account_owner: address,
          account_category: "main",
        },
        { ips: ipAddresses },
      );
    }

    const updatedMainAccount = await accounts.findOneAndUpdate(
      { account_owner: address, account_category: "main" },
      { step, active },
      { new: true },
    );
    if (step == 6) {
      let mainAccountMeta = await account_meta.findOne({
        address: mainAccount.account_owner,
      });

      let send_greeting = await account_helper.send_greeting_email(mainAccountMeta.email);
      return main_helper.success_response(res, {
        message: "success",
        account: updatedMainAccount,
        emailSent: send_greeting,
      });
    }

    return main_helper.success_response(res, {
      message: "success",
      account: updatedMainAccount,
    });
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "something went wrong");
  }
}

async function update_login_data(address, ipAddress) {
  try {
    if (!address) {
      return main_helper.error_message("You are not logged in");
    }

    const mainAccount = await accounts.findOne({
      account_owner: address,
      account_category: "main",
    });

    if (!mainAccount) {
      return main_helper.error_message("account not found");
    }

    let ipAddresses = mainAccount.ips ?? [];
    if (!ipAddresses.includes(ipAddress)) {
      ipAddresses.push(ipAddress);
      await accounts.findOneAndUpdate(
        {
          account_owner: address,
          account_category: "main",
        },
        { ips: ipAddresses },
      );
    }
    return true;
  } catch (e) {
    console.log(e);
    return "error";
  }
}

// create different accounts like loan,
async function create_different_accounts(req, res) {
  try {
    let { type } = req.body;

    let address = req.address;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("You are not logged in"),
      );
    }

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
      `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID_V3}`,
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
    `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID_V3}`,
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
  let { currentPassword, newPassword } = req.body;
  let address = req.address;

  if (!address) {
    return main_helper.error_response(res, "You are not logged in");
  }

  let account_meta_data = await account_meta.findOne({ address });
  if (account_meta_data && account_meta_data.email) {
    if (account_meta_data.verified) {
      const authAcc = await account_auth.findOne({ address });
      if (!authAcc) {
        const createdAuth = await account_auth.create({
          address,
          password: newPassword,
        });

        let infoObj = {};

        infoObj.hasPasswordSet = createdAuth?.password ? true : false;
        infoObj.otp_enabled = createdAuth?.otp_enabled;
        infoObj.otp_verified = createdAuth?.otp_verified;

        return main_helper.success_response(res, infoObj);
      }

      if (authAcc.password) {
        const pass_match = await authAcc.match_password(currentPassword);
        if (!pass_match) return main_helper.error_response(res, "incorrect password");
      }

      const updatedAuth = await account_auth.findOneAndUpdate(
        { address },
        { password: newPassword },
        { new: true },
      );

      let infoObj = {};

      infoObj.hasPasswordSet = updatedAuth?.password ? true : false;
      infoObj.otp_enabled = updatedAuth?.otp_enabled;
      infoObj.otp_verified = updatedAuth?.otp_verified;

      return main_helper.success_response(res, infoObj);
    } else {
      return main_helper.error_response(res, "email unverified");
    }
  } else {
    return main_helper.error_response(res, "please verify email");
  }
}

async function activate_account(req, res) {
  try {
    let address = req.address;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("You are not logged in"),
      );
    }

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

    const [userStakes, ratesObj] = await Promise.all([
      stakes.find({ address: address }),
      rates.findOne(),
    ]);

    //call rates

    const stakingContract = new web3.eth.Contract(
      STACK_ABI,
      process.env.STAKING_CONTRACT_ADDRESS,
    );

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

    function getDollarAMount(amount) {
      return Number((amount * Number(ratesObj?.atr?.usd))?.toFixed(2));
    }

    while (condition) {
      loopCount++;
      const result = await stakingContract.methods
        .stakersRecord(address, loopCount)
        .call();
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
        const StakersRes = await stakingContract.methods.Stakers(address).call();
        if (+StakersRes?.currTierId === 0) {
          updateObj.value = "Novice Navigator";
        } else if (+StakersRes?.currTierId === 1) {
          updateObj.value = "Stellar Standard";
        } else if (+StakersRes?.currTierId === 2) {
          updateObj.value = "Expert Edge";
        } else if (+StakersRes?.currTierId === 3) {
          updateObj.value = "Platinum Privilege";
        } else {
          updateObj.value = "Diamond VIP";
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
            A1_price: ratesObj?.atr?.usd ?? 2,
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
    let { extensions, setup } = req.body;
    let address = req.address;

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
        //   if (key === "trade" && value === "true") {
        //     const accountExtension = await accounts.findOne({
        //       account_owner: address,
        //       account_category: key,
        //     });
        //     if (!accountExtension) {
        //       const newAddress = await generate_new_address();
        //       const [] = await Promise.all([
        //         accounts.create({
        //           address: newAddress.toLowerCase(),
        //           balance: 0,
        //           account_category: key,
        //           account_owner: address,
        //           active: true,
        //         }),
        //       ]);
        //       updateObj[`extensions.${key}`] = value;
        //     } else {
        //       updateObj[`extensions.${key}`] = value;
        //     }
        //   } else {
        //     updateObj[`extensions.${key}`] = value;
        //   }
        // } else if (accountMain.active) {
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
          }
        }
        updateObj[`extensions.${key}`] = value;
      } else {
        if (key !== "trade" && key !== "loan" && key !== "notify") {
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
    let { type } = req.body;

    let address = req.address;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("You are not logged in"),
      );
    }

    if (!type) {
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

async function get_account(req, res) {
  try {
    let address = req.address;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("You are not logged in"),
      );
    }

    const aggregatedQuery = accounts.aggregate([
      { $match: { account_owner: address, account_category: "main" } },
      { $project: { ips: 0 } },
      {
        $lookup: {
          from: "account_metas",
          localField: "account_owner",
          foreignField: "address",
          as: "meta",
        },
      },
      { $unwind: "$meta" },
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

    const accounts_dataQuery = accounts.find(
      {
        $or: [{ account_owner: address }, { address: address }],
      },
      { _id: 0, address: 1, account_category: 1, assets: 1, balance: 1 },
    );

    const auth_accQuery = account_auth.findOne({ address: address });

    const [aggregatedResults, accounts_data, auth_acc] = await Promise.all([
      aggregatedQuery,
      accounts_dataQuery,
      auth_accQuery,
    ]);

    if (aggregatedResults[0]) {
      aggregatedResults[0].hasPasswordSet = auth_acc?.password ? true : false;
      aggregatedResults[0].otp_enabled = auth_acc?.otp_enabled;
      aggregatedResults[0].otp_verified = auth_acc?.otp_verified;
      aggregatedResults[0].stakedTotal = aggregatedResults[0].stakedTotal || 0;
    }

    return res.status(200).json({
      status: true,
      data: {
        accounts: aggregatedResults,
        accountBalances: accounts_data,
      },
    });
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error getting accounts");
  }
}

async function update_current_rates(req, res) {
  try {
    const apiKey = process.env.COMMODITIES_API_KEY;
    const base = process.env.BASE_CURRENCY;
    const commodities = process.env.COMMODITIES;
    
    const commodityResponse = await axios.get(`https://commodities-api.com/api/latest?access_key=${apiKey}&base=${base}&symbols=${commodities}`);
    const commodityData = commodityResponse.data;

    if (commodityData.data.success) {
      await rates.findOneAndUpdate(
        {},
        {
          gold: { usd: commodityData.data.rates.XAU },
          platinum: { usd: commodityData.data.rates.XPT },
        },
      );
    }

    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,tether&vs_currencies=usd",
    );

    const { bitcoin, ethereum } = response.data;

    if (
      bitcoin &&
      typeof bitcoin.usd === "number" &&
      ethereum &&
      typeof ethereum.usd === "number"
    ) {
      await rates.findOneAndUpdate(
        {},
        {
          btc: { usd: bitcoin.usd },
          eth: { usd: ethereum.usd },
          usdt: { usd: response.data?.["tether"]?.usd },
          bnb: { usd: response.data?.["binancecoin"]?.usd }
        },
      );
    } else {
      //console.error("Bitcoin and/or Ethereum rates are not valid numbers");
    }
  } catch (error) {
    //console.error("Error fetching rates:", error?.response ?? error);
  }
}

async function get_rates(req, res) {
  try {
    if (res) {
      const ratesObj = await rates.findOne();
      return res.status(200).json(ratesObj);
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json("failed to get rates");
  }
}

async function get_recepient_name(req, res) {
  try {
    let { address } = req.body;

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

async function logout(req, res) {
  try {
    let address = req.address;
    if (!address) return main_helper.error_response(res, "You are not logged in");

    // Clear cookies
    res.clearCookie("Access-Token");
    res.clearCookie("Refresh-Token");

    // const refreshToken = req.cookies["Refresh-Token"];
    // if (refreshToken) {
    //   await accounts.findOneAndUpdate(
    //     {
    //       account_owner: address,
    //       account_category: "main",
    //     },
    //     { $pull: { refresh_token_sessions: refreshToken } },
    //   );
    // }

    return res.status(200).send("Logged out successfully");
  } catch (e) {
    console.error(e);
    return main_helper.error_response(res, "error logging out");
  }
}

async function become_elite_member(req, res) {
  try {
    let address = req.address;
    if (!address) return main_helper.error_response(res, "You are not logged in");
    let account_change = await accounts.findOneAndUpdate(
      { account_owner: address, account_category: "main" },
      { elite_member: "pending" },
    );
    if (account_change) {
      return main_helper.success_response(res, "success");
    }
    return main_helper.error_response(res, "error");
  } catch (e) {
    console.error(e);
    return main_helper.error_response(res, "error logging out");
  }
}

module.exports = {
  index,
  logout,
  login_with_email,
  get_account,
  get_account_by_type,
  update_auth_account_password,
  create_different_accounts,
  activate_account,
  manage_extensions,
  handle_step,
  // open_utility_accounts,
  update_current_rates,
  get_rates,
  get_recepient_name,
  web3Connect,
  become_elite_member,
  update_login_data,
};
