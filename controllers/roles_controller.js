const { role } = require("account_models_test");
const main_helper = require("../helpers/index");

async function index(req, res) {
  try {
    let results = await role.find();
    console.log(results);
    if (!results.length) {
      results = await role.insertMany([
        {
          value: "SUPER_ADMIN",
        },
        {
          value: "ADMIN",
        },
        {
          value: "USER",
        },
      ]);
    }

    res.status(200).json(
      main_helper.return_data({
        status: true,
        data: { accounts: results },
      })
    );
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "error getting role");
  }
}
module.exports = {
  index,
};
