const express = require("express");
const router = express();
const roles_controller = require("../controllers/roles_controller");
const admin_controller = require("../controllers/admin_controller");
const account_controller = require("../controllers/accounts_controller");
const account_meta_controller = require("../controllers/accounts_meta_controller");
// const validation = require('../middleware/validation_middleware');

const google_2fa_controller = require("../controllers/google_2fa_controller");
// const validation = require('../middleware/validation_middleware');

const is_authenticated = require("../middleware/is_authenticated");

const cookieParser = require("cookie-parser");

router.use(cookieParser());
router.use(is_authenticated);

router.post("/login", account_controller.login_account);
router.post("/update_profile", account_meta_controller.update_meta);
router.post("/verify", account_meta_controller.verify);
router.post("/recovery/login", account_controller.login_with_email);
router.post("/resend-email", account_meta_controller.resend_email);
router.post(
  "/get-reset-password-email",
  account_meta_controller.get_reset_password_email,
);
router.post("/reset-password", account_meta_controller.reset_password);

router.post("/get_account", account_controller.get_account);
router.post("/update_profile_auth", account_controller.update_auth_account_password);

// google 2 factore auth routes
router.post("/otp/generate", google_2fa_controller.generate_OTP);
router.post("/otp/verify", google_2fa_controller.verify_OTP);
router.post("/otp/validate", google_2fa_controller.validate_OTP);
router.post("/otp/disable", google_2fa_controller.disable_OTP);

router.get("/test", (req, res) => {
  console.log(123);
  res.status(200).send("hi Jinx");
});

router.post("/koko", account_controller.create_different_accounts);
// roles
router.get("/roles", roles_controller.index);
// get all account
router.post("/filter", admin_controller.handle_filter);

module.exports = router;
