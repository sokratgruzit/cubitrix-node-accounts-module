const accounts = require("./routes/index");
const account_controller = require("./controllers/accounts_controller");

module.exports = {
  accounts: accounts,
  functions: { update_current_rates: account_controller.update_current_rates },
};
