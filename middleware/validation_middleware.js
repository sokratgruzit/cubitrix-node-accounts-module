const validator = require('../helpers/validate');

const profile = async (req, res, next) => {
    const validationRule = {
        address: "profile_model|exist:profile_model,address", 
        name: "required|string", 
        email: "required|email|exist:User,email", 
        wallet_type: "required", 
        mobile: "required", 
        date_of_birth: "required|string", 
        nationality: "required", 
        avatar: "required" 
    };

    await validator(req.body, validationRule, {}, (err, status) => {
        if (!status) {
            res.status(412)
                .send({
                    success: false,
                    message: 'Validation failed',
                    data: err
                });
        } else {
            next();
        }
    }).catch(err => console.log(err));
};

module.exports = {
    profile
};