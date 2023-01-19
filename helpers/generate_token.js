const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const generate_token = (address, time) => {
    return jwt.sign(
        address, 
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: time }
    );
};

module.exports = generate_token;