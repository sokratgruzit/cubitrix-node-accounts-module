const mongoose = require("mongoose");
const verified_emails = new mongoose.Schema(
  {
    email: String,
    verified_at: String,
    verified: Boolean,
    verification_code: String,
    address: String,
  },
  {
    timestamps: true,
  }
);
verified_emails.index({ verified_at: -1 });

module.exports = mongoose.model("verified_emails", verified_emails);
