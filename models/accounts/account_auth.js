const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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
    otp_enabled: {
      type: Boolean,
      default: false,
    },
    otp_verified: {
      type: Boolean,
      default: false,
    },
    otp_ascii: String,
    otp_hex: String,
    otp_base32: String,
    otp_auth_url: String,
    remember_token: String,
    keys: String,
  },
  {
    timestamps: true,
  },
);

account_auth.pre("save", async function (next) {
  if (!this.isModified || !this.password) {
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
