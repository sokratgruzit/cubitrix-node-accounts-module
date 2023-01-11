const mongoose = require("mongoose");
const verified_emails = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
      unique: true,
      dropDups: true,
    },
    verified_at: String,
    verified: Boolean,
    verification_code: Number,
    address: {
      type: String,
      required: true,
      index: true,
      unique: true,
      dropDups: true,
    },
  },
  {
    timestamps: true,
  }
);
verified_emails.index({ verified_at: -1 }, { unique: true });

module.exports = mongoose.model("verified_emails", verified_emails);
