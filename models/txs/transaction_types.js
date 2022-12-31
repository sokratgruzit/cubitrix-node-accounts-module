const mongoose = require("mongoose");

const transaction_types = new mongoose.Schema(
  {
    name: String,
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("transaction_types", transaction_types);
