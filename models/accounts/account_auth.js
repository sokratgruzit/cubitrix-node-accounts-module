const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

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
    keys: String
  },
  {
    timestamps: true,
  }
);

account_auth.pre('save', async function (next) {
  if (!this.isModified) {
      next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

account_auth.methods.match_password = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

account_auth.index({ address: -1 }, { unique: true });

module.exports = mongoose.model("account_auth", account_auth);
