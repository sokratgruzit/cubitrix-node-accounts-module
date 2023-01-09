const jwt = require("jsonwebtoken");

function isAuthenticated(req, res, next) {
  // const accessToken = req.cookies["Access-Token"];
  const accessToken = null;

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, "jwt_secret");
      console.log(decoded);
    } catch (e) {}
  }
  next();
}

module.exports = isAuthenticated;
