const mongoose = require("mongoose");
const {Schema} = require('mongoose');
const accounts = new mongoose.Schema(
  {
    address: String,
    balance: Number,
    account_category: String,
    account_type_id: { type: Schema.Types.ObjectId, ref: 'account_types' },
    account_owner: String, 
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("accounts", accounts);
