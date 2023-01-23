const accaunts = require("../../models/accounts/accounts");
const main_helper = require("../../helpers/index"); 

require("dotenv").config();

async function get_accounts(req, res) {
  try {
    let options = {
      limit: req.query.limit || 2,
      page: req.query.page || 2
    };
    let results = await accaunts.aggregate([{
      $lookup: {
        from: 'account_metas',
        localField: 'address',
        foreignField: 'address',
        as: 'meta'
      }
    }])
    results = await accaunts.aggregatePaginate(results, options);
    results = await accaunts.populate(results, {
      path: 'account_type_id'
    });

    res.status(200).json(main_helper.return_data({
      status: true,
      data: { accounts: results }
    }));
  } catch (e) {
    console.log(e)
    return main_helper.error_response(res, "error getting accounts");
  }
}
module.exports = {
  get_accounts,
};
