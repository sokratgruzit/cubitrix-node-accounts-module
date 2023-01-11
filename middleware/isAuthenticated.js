const jwt = require("jsonwebtoken");

function isAuthenticated(req, res, next) {
  const accessToken = req.cookies["Access-Token"];

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, "jwt_secret");
      req.auth.address = decoded.address;
      req.auth.email = decoded.email;
    } catch (e) {}
  }
  next();
}

module.exports = isAuthenticated;
