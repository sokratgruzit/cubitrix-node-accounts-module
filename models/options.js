const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const options = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      index: true,
      unique: true,
      dropDups: true,
    },
    value: String,
    onject_value: Object,
  },
  {
    timestamps: true,
  }
);
options.index({ key: -1 }, { unique: true });
module.exports = mongoose.model("options", options);
