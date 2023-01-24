const accounts = require("../models/accounts/accounts");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");

require("dotenv").config();

async function get_accounts(req, res) {
  try {
    let options = {
      limit: req.query.limit || 2,
      page: req.query.page || 2,
    };
    let results = await accounts.aggregate([
      {
        $lookup: {
          from: "account_metas",
          localField: "address",
          foreignField: "address",
          as: "meta",
        },
      },
    ]);
    results = await accounts.aggregatePaginate(results, options);
    results = await accounts.populate(results, {
      path: "account_type_id",
    });

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

async function handle_filter(req, res) {
  try {
    let filtered;
    const data = await req.body;

    const account_type_id = await account_helper.get_type_id(
      data.account_type_id
    );

    if (account_type_id) {
      //data.account_type_id = account_type_id.toString();
      console.log(data);
    } else {
      console.log("nehi", data);
    }

    filtered = await accounts.find(data);
    console.log(filtered);

    res.status(200).json(
      main_helper.return_data({
        status: true,
        data: filtered,
      })
    );
  } catch (e) {
    return main_helper.error_message(e);
  }
}

module.exports = {
  get_accounts,
  handle_filter,
};
