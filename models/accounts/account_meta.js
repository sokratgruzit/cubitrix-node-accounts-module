const mongoose = require("mongoose");

const account_meta = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      index: true,
      unique: true,
      dropDups: true,
    },
    name: String,
    email: String,
    status: String,
    mobile: Number,
    date_of_birth: Date,
    nationality: String,
    last_login: Date,
    avatar: String,
  },
  {
    timestamps: true,
  }
);
account_meta.index({ address: -1 }, { unique: true });

module.exports = mongoose.model("account_meta", account_meta);
