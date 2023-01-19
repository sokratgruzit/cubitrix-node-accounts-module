const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const verify_jwt = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader) return res.status(401).json({ "message": "Unauthorized" });
    
    const token = authHeader.split(' ')[1];
    
    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decoded) => {
            if (err) return res.status(403).json({ "message": "Authorization failed" });
            req.address = decoded.address;
            next();
        }
    )
};

module.exports = verify_jwt;