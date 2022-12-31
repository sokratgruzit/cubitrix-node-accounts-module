const mongoose = require("mongoose");

const accounts = new mongoose.Schema(
  {
    address: String,
    balance:Number,
    account_category:String,
    account_type_id:Number,
    account_owner:String
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("accounts", accounts);
