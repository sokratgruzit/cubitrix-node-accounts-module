const { account_meta, account_auth } = require("@cubitrix/models");
const main_helper = require("../helpers/index");
const account_helper = require("../helpers/accounts");
require("dotenv").config();

// logic of checking profile info
// async function update_meta(req, res) {
//   try {
//     let { address, name, email, mobile, date_of_birth, nationality, avatar } = req.body;

//     if (!address && req.auth) {
//       address = req.auth.address;
//     }

//     if (address == undefined) {
//       return main_helper.error_response(
//         res,
//         main_helper.error_message("Fill all fields"),
//       );
//     }

//     address = address.toLowerCase();

//     let account_meta_exists = await account_meta.findOne({
//       address,
//     });
//     if (account_meta_exists) {
//       if (account_meta_exists.email && account_meta_exists?.email === email) {
//         await account_meta_exists.updateOne({
//           address,
//           name,
//           email,
//           mobile,
//           date_of_birth,
//           nationality,
//           avatar,
//         });
//         return main_helper.success_response(res, "account updated");
//       } else {
//         if (account_meta_exists.email && account_meta_exists?.email !== email) {
//           await verified_emails.deleteMany({ address });
//           await account_meta_exists.updateOne({
//             address,
//             name,
//             mobile,
//             email: "",
//             date_of_birth,
//             nationality,
//             avatar,
//           });
//           const response = await account_helper.check_and_send_verification_email(
//             address,
//             email,
//           );
//           if (response.success) {
//             return main_helper.success_response(res, response.message);
//           }
//           return main_helper.error_response(res, response.message);
//         } else {
//           const updated = await account_meta_exists.updateOne({
//             address,
//             name,
//             mobile,
//             date_of_birth,
//             nationality,
//             avatar,
//           });
//           if (email) {
//             const response = await account_helper.check_and_send_verification_email(
//               address,
//               email,
//             );
//             if (response.success) {
//               return main_helper.success_response(res, response.message);
//             }
//             return main_helper.error_response(res, response.message);
//           }
//           if (updated.acknowledged) {
//             return main_helper.success_response(res, "success");
//           }
//           return main_helper.error_response(res, "could not update");
//         }
//       }
//     } else {
//       let account_saved = await save_account_meta(
//         address,
//         name,
//         mobile,
//         new Date(date_of_birth),
//         nationality,
//         avatar,
//       );

//       if (account_saved.success) {
//         if (email) {
//           const response = await account_helper.check_and_send_verification_email(
//             address,
//             email,
//           );
//           if (response.success) {
//             return main_helper.success_response(res, response?.message);
//           }
//           return main_helper.error_response(res, response?.message);
//         }
//         return main_helper.success_response(res, "updated");
//       }
//       return main_helper.error_response(res, account_saved.message);
//     }
//   } catch (e) {
//     return main_helper.error_response(res, main_helper.error_message(e.message));
//   }
// }

async function update_meta(req, res) {
  try {
    let { name, email, mobile, date_of_birth, nationality, avatar } = req.body;

    let address = req.address;

    if (!address) {
      return main_helper.error_response(
        res,
        main_helper.error_message("you are not logged in"),
      );
    }

    let account_meta_exists = await account_meta.findOne({
      address,
    });

    if (account_meta_exists) {
      const updated = await account_meta.findOneAndUpdate(
        { address },
        {
          address,
          name,
          email,
          mobile,
          date_of_birth,
          nationality,
          avatar,
          verified_at: null,
          verified: false,
          verification_code: "",
        },
        { new: true },
      );
      if (updated) {
        return main_helper.success_response(res, updated);
      }
      return main_helper.error_response(res, "could not update");
    } else {
      let account_saved = await save_account_meta(
        address,
        name,
        mobile,
        new Date(date_of_birth),
        nationality,
        avatar,
        email, // Include email for a new account.
      );

      if (account_saved.success) {
        return main_helper.success_response(res, "updated");
      }
      return main_helper.error_response(res, account_saved.message);
    }
  } catch (e) {
    return main_helper.error_response(res, main_helper.error_message(e.message));
  }
}

// verification code
async function verify(req, res) {
  try {
    let { code } = req.body;
    let verification = await account_meta.findOne({
      verification_code: code,
    });

    if (verification) {
      await Promise.allSettled([
        verification.updateOne({
          verified_at: Date.now(),
          verified: true,
        }),
        account_meta.findOneAndUpdate(
          { address: verification.address },
          { email: verification.email },
        ),
      ]);

      return main_helper.success_response(res, {
        success: true,
      });
    }
    return main_helper.error_response(res, {
      success: false,
    });
  } catch (e) {
    return main_helper.error_response(res, {
      success: false,
    });
  }
}
// saving already checked profile meta data
async function save_account_meta(
  address,
  name,
  mobile,
  date_of_birth,
  nationality,
  avatar,
  email,
) {
  try {
    let data = {
      address: address,
      name: name,
      mobile: mobile,
      date_of_birth: new Date(date_of_birth),
      nationality: nationality,
      avatar: avatar,
      email: email,
      verified_at: null,
      verified: false,
      verification_code: "",
    };

    let save_user = await account_meta.create(data);

    if (save_user) {
      return main_helper.success_message("User meta saved");
    }
    return main_helper.error_message("Error while saving user meta");
  } catch (e) {
    return main_helper.error_message(e.message);
  }
}

async function resend_email(req, res) {
  try {
    let address = req.address;

    if (!address) return main_helper.error_response(res, "you are not logged in");
    const code = await account_helper.generate_verification_code();
    const verify_email = await account_meta.findOne({
      address: address.toLowerCase(),
    });

    if (!verify_email) return main_helper.error_response(res, "email resend failed");

    await verify_email.updateOne({
      verified_at: null,
      verified: false,
      verification_code: code,
      address,
    });

    const email_sent = await account_helper.send_verification_mail(
      verify_email.email,
      code,
    );

    if (email_sent.success) return main_helper.success_response(res, "email sent");
    return main_helper.error.response(res, "email resend failed");
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "email resend failed");
  }
}

async function check_email(req, res) {
  let { email } = req.body;

  try {
    const emailExists = await account_meta.findOne({ email });

    if (emailExists) {
      return main_helper.success_response(res, {
        msg: "This email already taken",
        status: false,
      });
    } else {
      return main_helper.success_response(res, {
        msg: "This email is available",
        status: true,
      });
    }
  } catch (e) {
    console.log(e);
    return main_helper.error_response(res, "Something went wrong");
  }
}

async function get_reset_password_email(req, res) {
  try {
    let { email } = req.body;

    const meta = await account_meta.findOne({ email });

    if (!meta) return main_helper.error_response(res, "No such email found");

    const code = await account_helper.generate_verification_code();

    await account_auth.findOneAndUpdate(
      { address: meta.address },
      { password_reset_code: code },
    );

    const response = await account_helper.send_reset_password_email(email, code);

    if (response.success)
      return main_helper.success_response(res, "You will receive a reset email");

    return main_helper.error_response(res, `Email couldn't be sent`);
  } catch (e) {
    return main_helper.error_response(res, e);
  }
}

async function reset_password(req, res) {
  try {
    let { code, password } = req.body;

    if (!code) return main_helper.error_response(res, "code required");
    const updated = await account_auth.findOneAndUpdate(
      { password_reset_code: code },
      { password_reset_code: "", password: password },
    );

    if (!updated) return main_helper.error_response(res, "failed to update password");

    return main_helper.success_response(res, "password updated");
  } catch (e) {
    return main_helper.error_response(res, e?.message);
  }
}

module.exports = {
  update_meta,
  verify,
  resend_email,
  get_reset_password_email,
  reset_password,
  check_email,
};
