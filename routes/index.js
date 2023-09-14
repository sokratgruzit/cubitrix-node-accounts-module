const express = require("express");
const router = express();
const roles_controller = require("../controllers/roles_controller");
const account_controller = require("../controllers/accounts_controller");
const account_meta_controller = require("../controllers/accounts_meta_controller");
// const validation = require('../middleware/validation_middleware');

const google_2fa_controller = require("../controllers/google_2fa_controller");
// const validation = require('../middleware/validation_middleware');

const cookieParser = require("cookie-parser");

router.use(cookieParser());

router.post("/web3Connect", account_controller.web3Connect);
router.post("/recovery/login", account_controller.login_with_email);
router.post("/logout", account_controller.logout);
router.post("/update_profile_auth", account_controller.update_auth_account_password);
router.post("/update_profile", account_meta_controller.update_meta);

router.post("/verify", account_meta_controller.verify);
router.post("/resend-email", account_meta_controller.resend_email);
router.post(
  "/get-reset-password-email",
  account_meta_controller.get_reset_password_email,
);
router.post("/reset-password", account_meta_controller.reset_password);
router.post("/activate-account", account_controller.activate_account);
router.post("/handle-step", account_controller.handle_step);

router.post("/get_account", account_controller.get_account);
router.post("/get_account_by_type", account_controller.get_account_by_type);

// google 2 factore auth routes
router.post("/otp/generate", google_2fa_controller.generate_OTP);
router.post("/otp/verify", google_2fa_controller.verify_OTP);
router.post("/otp/validate", google_2fa_controller.validate_OTP);
router.post("/otp/disable", google_2fa_controller.disable_OTP);

router.get("/test", (req, res) => {
  console.log("hello api");
  res.status(200).send("hello api");
});

router.post("/create_different_accounts", account_controller.create_different_accounts);
router.post("/manage_extensions", account_controller.manage_extensions);
// roles
router.get("/roles", roles_controller.index);

router.get("/get_rates", account_controller.get_rates);
router.post("/get_recepient_name", account_controller.get_recepient_name);

router.post("/check-email", account_meta_controller.check_email);
// get all account

module.exports = router;
