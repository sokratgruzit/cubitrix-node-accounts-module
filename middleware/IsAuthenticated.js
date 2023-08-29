const jwt = require("jsonwebtoken");

function isAuthenticated(req, res, next) {
  const accessToken = req?.cookies?.["Access-Token"];
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, "JWT_SECRET");
      req.address = decoded.address;
    } catch (e) {
      refresh(req, res);
    }
  }
  next();
}

function refresh(req, res) {
  const refreshToken = req.cookies?.["Refresh-Token"];
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, "JWT_SECRET");
      const accessToken = jwt.sign({ address: decoded.address }, "JWT_SECRET", {
        expiresIn: "15m",
      });
      req.address = decoded.address;
      res.cookie("Access-Token", accessToken, {
        sameSite: "none",
        httpOnly: true,
        secure: true,
      });
    } catch (e) {}
  }
}

module.exports = isAuthenticated;
