const { account_auth } = require("@cubitrix/models");
const main_helper = require("../helpers/index");
const speakeasy = require("speakeasy");

const generate_OTP = async (req, res) => {
  let { address } = req.body;

  address = address.toLowerCase();

  const { ascii, hex, base32, otpauth_url } = speakeasy.generateSecret({
    issuer: "codevoweb.com",
    name: "admin@admin.com",
    length: 15,
  });

  let update_account_auth = await account_auth.findOneAndUpdate(
    { address: address },
    {
      address: address,
      otp_ascii: ascii,
      otp_auth_url: otpauth_url,
      otp_base32: base32,
      otp_hex: hex,
    },
  );

  if (update_account_auth) {
    return main_helper.success_response(res, {
      base32,
      otpauth_url,
    });
  }

  return main_helper.error_response(res, "Error while updating account");
};

const verify_OTP = async (req, res) => {
  let { address, token } = req.body;

  address = address.toLowerCase();

  const account = await account_auth.findOne({ address });

  if (!account) {
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  const verified = speakeasy.totp.verify({
    secret: account_auth.otp_base32,
    encoding: "base32",
    token: token,
  });

  if (!verified) {
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  let update_account_auth = await account_auth.findOneAndUpdate(
    { address: address },
    {
      otp_enabled: true,
      otp_verified: true,
    },
  );

  if (update_account_auth) {
    return main_helper.success_response(res, {
      otp_verified: true,
      address: address,
      otp_enabled: update_account_auth.otp_enabled,
    });
  }

  return main_helper.error_response(res, "Error while updating account auth");
};

const validate_OTP = async (req, res) => {
  let { address, token } = req.body;

  address = address.toLowerCase();

  const account = await account_auth.findOne({ address });

  if (!account) {
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  const valid_token = speakeasy.totp.verify({
    secret: account_auth?.otp_base32,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!valid_token) {
    return main_helper.error_response(res, "Token is invalid or user doesn't exist");
  }

  if (valid_token) {
    return main_helper.success_response(res, {
      otp_valid: true,
    });
  }

  return main_helper.error_response(res, "Token is invalid or user doesn't exist");
};

const disable_OTP = async (req, res) => {
  let { address } = req.body;

  address = address.toLowerCase();

  const account = await account_auth.findOne({ address });

  if (!account) {
    return main_helper.error_response(res, "Account doesn't exist");
  }

  let update_account_auth = await account_auth.findOneAndUpdate(
    { address: address },
    {
      otp_enabled: false,
    },
  );

  if (update_account_auth) {
    return main_helper.success_response(res, {
      otp_disabled: true,
      address: address,
      otp_enabled: update_account_auth.otp_enabled,
    });
  }

  return main_helper.error_response(res, "Account doesn't updated");
};

module.exports = {
  generate_OTP,
  verify_OTP,
  validate_OTP,
  disable_OTP,
};
