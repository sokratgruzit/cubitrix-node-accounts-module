const jwt = require("jsonwebtoken");

function is_authenticated(req, res, next) {
  const accessToken = req.cookies["Access-Token"];
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, "jwt_secret");
      req.auth = { address: decoded.address, email: decoded.email };
    } catch (e) {}
  }
  next();
}

module.exports = is_authenticated;
