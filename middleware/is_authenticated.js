const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

function is_authenticated(req, res, next) {
  const accessToken = req.cookies["Access-Token"];
  const secret = process.env.ACCESS_TOKEN_SECRET;

  if (!accessToken) return res.status(401).json({ message: "Unauthorized" });

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, secret);
      req.auth = { address: decoded.address.toLowerCase(), email: decoded.email };
    } catch (e) {}
  }
  next();
}

module.exports = is_authenticated;
