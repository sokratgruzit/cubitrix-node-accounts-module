const accounts = require("./controllers/accounts_controller");
const accounts_index = require("./routes/index");

module.exports = {
  accounts: accounts,
  accounts_index: accounts_index,
};
