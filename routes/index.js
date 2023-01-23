const express = require("express");
const router = express();
const admin_account_controller = require("../controllers/admin/accouts_controller");
const account_controller = require("../controllers/accounts_controller");
const account_meta_controller = require("../controllers/accounts_meta_controller");
const helper = require("../helpers/accounts");
// const validation = require('../middleware/validation_middleware');

const g2faController = require("../controllers/google_2fa_controller");
// const validation = require('../middleware/validation_middleware');

const isAuthenticated = require("../middleware/isAuthenticated");

const cookieParser = require("cookie-parser");

router.use(cookieParser());
router.use(isAuthenticated);

router.post("/login", account_controller.login_account);
router.post("/update_profile", account_meta_controller.update_meta);
router.post("/verify", account_meta_controller.verify);

router.post("/recovery/login", account_controller.login_with_email);
router.post(
  "/update_profile_auth",
  account_controller.update_auth_account_password
);

// google 2 factore auth routes
router.post("/otp/generate", g2faController.generate_OTP);
router.post("/otp/verify", g2faController.verify_OTP);
router.post("/otp/validate", g2faController.validate_OTP);
router.post("/otp/disable", g2faController.disable_OTP);

router.get("/test", (req, res) => {
  console.log(123);
  res.status(200).send("hi Jinx");
});
router.get("/koko", account_controller.create_different_accounts);

//get all accaunt
router.get("/all_accaunt", admin_account_controller.get_accounts);
module.exports = router;
