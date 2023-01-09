const express = require("express");
const router = express();
const baseController = require("../controllers/accounts_controller");
const g2faController = require("../controllers/google_2fa_controller");
// const validation = require("../middleware/validation_middleware");

const isAuthenticated = require("../middleware/isAuthenticated");

router.use(isAuthenticated);

router.post("/login", baseController.login_account);
router.post("/update_profile", baseController.update_meta);
router.post("/recovery/login", baseController.login_with_email);

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
