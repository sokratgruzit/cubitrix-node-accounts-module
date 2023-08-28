const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const generate_token = (address, email, time, type) => {
    let secret = type === "access_token" ? process.env.ACCESS_TOKEN_SECRET : process.env.REFRESH_TOKEN_SECRET;

    return jwt.sign(
        { address, email }, 
        secret,
        { expiresIn: time }
    );
};

module.exports = generate_token;