const { accounts, transactions, account_meta } = require("@cubitrix/models");
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
    let result, total_pages;
    const req_body = await req.body;
    const req_type = req_body.type;
    const req_page = req_body.page ? req_body.page : 1;
    const limit = 2;
    let { type, page, ...data } = req_body;

    const account_type_id = await account_helper.get_type_id(
      data.account_type_id
    );

    if (data.search) {
      data.search = data.search.toLowerCase();
    }

    if (data.address || (data.search && data.address)) {
      let { search, ...without_search } = data;
      data = without_search;
      data.address = data.address.toLowerCase();
    }

    if (account_type_id) {
      data.account_type_id = account_type_id.toString();
    }

    if (!account_type_id) {
      const { account_type_id, ...no_type_id } = data;
      data = no_type_id;
    }

    if (req_type === "account") {
      if (data.search) {
        result = await accounts.find({
          address: { $regex: data.search, $options: "i" },
        });

        if (result.length === 0) {
          let q;

          if ("user_current".includes(data.search)) q = "user_current";

          if ("loan".includes(data.search)) q = "loan";

          if ("staking".includes(data.search)) q = "staking";

          if ("trade".includes(data.search)) q = "trade";

          let account_type = await account_helper.get_type_id(q);

          result = await accounts
            .find({ account_type_id: account_type })
            .sort({ cteatedAt: "desc" })
            .limit(limit)
            .skip(limit * (req_page - 1));
          total_pages = await accounts.count({ account_type_id: account_type });
        }
      } else {
        result = await accounts.find(data);
        total_pages = await accounts.count(data);
      }
    }
    if (req_type === "transactions") {
      if (data.search) {
      } else {
        result = await transactions
          .find(data)
          .sort({ cteatedAt: "desc" })
          .limit(limit)
          .skip(limit * (req_page - 1));
        total_pages = await transactions.count(data);
      }
    }
    if (req_type === "users") {
      if (data.search) {
      } else {
        result = await account_meta
          .find(data)
          .sort({ cteatedAt: "desc" })
          .limit(limit)
          .skip(limit * (req_page - 1));
        total_pages = await account_meta.count(data);
      }
    }

    return res.status(200).json(
      main_helper.return_data({
        status: true,
        data: result,
        pages: Math.ceil(total_pages / limit),
      })
    );
  } catch (e) {
    return main_helper.error_response(res, e.message);
  }
}

module.exports = {
  get_accounts,
  handle_filter,
};
