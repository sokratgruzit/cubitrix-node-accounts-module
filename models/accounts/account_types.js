const mongoose = require("mongoose");

const account_types = new mongoose.Schema(
  {
    name:String
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("account_types", account_types);
