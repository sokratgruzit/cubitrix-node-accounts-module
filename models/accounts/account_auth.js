const mongoose = require("mongoose");

const account_auth = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      index: true,
      unique: true,
      dropDups: true,
    },
    password: String,
    google2fa: Number,
    google2fa_secret: String,
    remember_token: String,
    keys:String
  },
  {
    timestamps: true,
  }
);
account_auth.index({ address: -1 }, { unique: true });

module.exports = mongoose.model("account_auth", account_auth);
