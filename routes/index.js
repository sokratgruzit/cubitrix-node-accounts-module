const express = require("express");
const router = express();
const baseController = require("../controllers/accounts_controller");
const helper = require("../helpers/accounts");
// const validation = require('../middleware/validation_middleware');

router.post("/login", baseController.login_account);
// router.post("/update_profile", baseController.update_meta);
router.get("/testEmail", helper.send_verification_mail);
router.get("/test", (req, res) => {
  console.log(123);
  res.status(200).send("hi Jinx");
});

module.exports = router;
