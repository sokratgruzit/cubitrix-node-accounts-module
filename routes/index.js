const express = require("express");
const router = express();
const baseController = require("../controllers/accounts_controller");
const accountsMetaController = require("../controllers/accounts_meta_controller");
const helper = require("../helpers/accounts");
// const validation = require('../middleware/validation_middleware');

const g2faController = require("../controllers/google_2fa_controller");
// const validation = require('../middleware/validation_middleware');

const isAuthenticated = require("../middleware/isAuthenticated");

const cookieParser = require("cookie-parser");

router.use(cookieParser());
router.use(isAuthenticated);

router.post("/login", baseController.login_account);
router.post("/update_profile", accountsMetaController.update_meta);
router.get("/testEmail", helper.send_verification_mail);
router.post("/recovery/login", baseController.login_with_email);
router.post("/update_profile_auth", baseController.update_auth_account_password);

// google 2 factore auth routes
router.post("/otp/generate", g2faController.generate_OTP);
router.post("/otp/verify", g2faController.verify_OTP);
router.post("/otp/validate", g2faController.validate_OTP);
router.post("/otp/disable", g2faController.disable_OTP);

router.get("/test", (req, res) => {
  console.log(123);
  res.status(200).send("hi Jinx");
});

module.exports = router;
