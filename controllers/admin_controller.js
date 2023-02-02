const {
  accounts,
  transactions,
  account_meta,
  user,
} = require("@cubitrix/models");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");

require("dotenv").config();

async function handle_filter(req, res) {
  try {
    let result,
      total_pages,
      search_value,
      search_option,
      search_query,
      select_value,
      final_value,
      parent_account = [],
      parent_select_account = [],
      child_acocunts = [],
      child_select_acocunts = [],
      all_accounts_list,
      select_accounts = [],
      all_select_accounts_list,
      all_value = [],
      account_type_id;
    const req_body = await req.body;
    const req_type = req_body.type;
    const req_page = req_body.page ? req_body.page : 1;
    const req_filter = req_body.filter;
    const limit = 10;
    let { type, page, filter, ...data } = req_body;

    if (data.search) {
      data.search = data.search.toLowerCase();
    }

    if (data.address || (data.search && data.address)) {
      let { search, ...without_search } = data;
      data = without_search;
      data.address = data.address.toLowerCase();
    }

    if (req_type === "account") {
      if (req_filter && !isEmpty(req_filter)) {
        if (
          req_filter?.selects &&
          req_filter?.selects?.account_type_id != "all"
        ) {
          select_value = req_filter?.selects?.account_type_id;
          account_type_id = await account_helper.get_type_id(select_value);
        }

        if (
          !req_filter?.search?.option ||
          req_filter?.search?.option == "all"
        ) {
          search_option = "all";
        } else {
          search_option = req_filter?.search?.option;
        }
        search_value = req_filter?.search?.value;
        if (search_value) {
          if (search_option == "all") {
            all_accounts_list = await accounts.find({
              $or: [
                { address: { $regex: search_value, $options: "i" } },
                { account_owner: { $regex: search_value, $options: "i" } },
              ],
            });
            for (let i = 0; i < all_accounts_list.length; i++) {
              let one_account = all_accounts_list[i];
              if (one_account.account_owner == "") {
                parent_account.push(one_account.address);
              }
            }
            all_value.push({ address: { $in: parent_account } });
          } else {
            all_value.push({
              [search_option]: { $regex: search_value, $options: "i" },
            });
          }
        }
        if (select_value && select_value != "all") {
          all_select_accounts_list = await accounts.find({
            account_type_id: account_type_id,
          });
          for (let i = 0; i < all_select_accounts_list.length; i++) {
            let one_account = all_select_accounts_list[i];
            if (one_account.account_owner != "") {
              parent_select_account.push(one_account.account_owner);
            }
          }
          if (all_value && !isEmpty(all_value)) {
            for (let k = 0; k < parent_select_account.length; k++) {
              select_accounts.push(parent_select_account[k]);
            }

            all_value = [{ address: { $in: select_accounts } }];
          } else {
            all_value.push({ address: { $in: parent_select_account } });
          }
        }
        if (!all_value && !isEmpty(all_value)) {
          search_query = {};
        } else {
          search_query = { $or: all_value };
        }
        result = await accounts.aggregate([
          { $match: search_query },
          {
            $lookup: {
              from: "accounts",
              localField: "address",
              foreignField: "account_owner",
              as: "inner_accounts",
              pipeline: [
                {
                  $lookup: {
                    from: "account_types",
                    localField: "account_type_id",
                    foreignField: "_id",
                    as: "account_type_id",
                  },
                },
                { $unwind: "$account_type_id" },
              ],
            },
          },
          {
            $lookup: {
              from: "account_types",
              localField: "account_type_id",
              foreignField: "_id",
              as: "account_type_id",
            },
          },
          { $unwind: "$account_type_id" },
          {
            $limit: limit + limit * (req_page - 1),
          },
          {
            $skip: limit * (req_page - 1),
          },
        ]);
        total_pages = await accounts.count(search_query);
      } else {
        result = await accounts.aggregate([
          {
            $match: {
              account_owner: "",
            },
          },
          { $sort: { createdAt: -1 } },
          {
            $lookup: {
              from: "accounts",
              localField: "address",
              foreignField: "account_owner",
              as: "inner_accounts",
              pipeline: [
                {
                  $lookup: {
                    from: "account_types",
                    localField: "account_type_id",
                    foreignField: "_id",
                    as: "account_type_id",
                  },
                },
                { $unwind: "$account_type_id" },
              ],
            },
          },
          {
            $lookup: {
              from: "account_types",
              localField: "account_type_id",
              foreignField: "_id",
              as: "account_type_id",
            },
          },
          { $unwind: "$account_type_id" },
          {
            $limit: limit + limit * (req_page - 1),
          },
          {
            $skip: limit * (req_page - 1),
          },
        ]);
        total_pages = await accounts.count({ account_owner: "" });
      }
    }
    if (req_type === "transactions") {
      if (req_filter && !isEmpty(req_filter)) {
        select_tx_status_value = req_filter?.selects?.tx_status;
        select_tx_type_value = req_filter?.selects?.tx_type;
        if (
          !req_filter?.search?.option ||
          req_filter?.search?.option == "all"
        ) {
          search_option = "all";
        } else {
          search_option = req_filter?.search?.option;
        }
        search_value = req_filter?.search?.value;

        if (search_option == "all") {
          all_value.push(
            { tx_hash: { $regex: search_value, $options: "i" } },
            { from: { $regex: search_value, $options: "i" } },
            { to: { $regex: search_value, $options: "i" } }
          );
        } else {
          all_value = [
            {
              [search_option]: { $regex: search_value, $options: "i" },
            },
          ];
        }
        if (
          (!isEmpty(select_tx_status_value) &&
            select_tx_status_value != "all") ||
          (!isEmpty(select_tx_type_value) && select_tx_type_value != "all")
        ) {
          if (search_value) {
            final_value = [{ $or: all_value }];
          } else {
            final_value = [];
          }
          if (!isEmpty(select_tx_status_value) && select_tx_status_value) {
            final_value.push({ tx_status: select_tx_status_value });
          }

          if (!isEmpty(select_tx_type_value) && select_tx_type_value) {
            final_value.push({ tx_type: select_tx_type_value });
          }

          search_query = {
            $and: final_value,
          };
        } else {
          search_query = { $or: all_value };
        }
        result = await transactions
          .find(search_query)
          .sort({ cteatedAt: "desc" })
          .limit(limit)
          .skip(limit * (req_page - 1));
        total_pages = await transactions.count(search_query);
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
      if (req_filter && !isEmpty(req_filter)) {
        select_value = req_filter?.selects?.nationality;

        if (
          !req_filter?.search?.option ||
          req_filter?.search?.option == "all"
        ) {
          search_option = "all";
        } else {
          search_option = req_filter?.search?.option;
        }
        search_value = req_filter?.search?.value;

        if (search_option == "all") {
          all_value.push(
            { name: { $regex: search_value, $options: "i" } },
            { address: { $regex: search_value, $options: "i" } },
            { email: { $regex: search_value, $options: "i" } }
          );
          if (typeof search_option == "number") {
            all_value.push({ mobile: { $regex: search_value, $options: "i" } });
          }
        } else {
          all_value = [
            {
              [search_option]: { $regex: search_value, $options: "i" },
            },
          ];
        }
        if (select_value && select_value != "all") {
          search_query = {
            $and: [{ nationality: select_value }, { $or: all_value }],
          };
        } else {
          search_query = { $or: all_value };
        }

        result = await account_meta
          .find(search_query)
          .sort({ cteatedAt: "desc" })
          .limit(limit)
          .skip(limit * (req_page - 1));
        total_pages = await account_meta.count(search_query);
      } else {
        result = await account_meta
          .find(data)
          .sort({ cteatedAt: "desc" })
          .limit(limit)
          .skip(limit * (req_page - 1));
        total_pages = await account_meta.count(data);
      }
    }
    if (req_type === "admins") {
      result = await user
        .find()
        .sort({ cteatedAt: "desc" })
        .limit(limit)
        .skip(limit * (req_page - 1));
      total_pages = await user.count();
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
function isEmpty(obj) {
  for (var prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      return false;
    }
  }

  return JSON.stringify(obj) === JSON.stringify({});
}

module.exports = {
  handle_filter,
};
