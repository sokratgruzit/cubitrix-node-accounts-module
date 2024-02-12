function verification_template(verification_link, userName) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Email Verification</title>
  </head>
  <body>
    <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #fff; border-collapse: collapse;">
      <tr>
        <td style="padding: 20px;">
          <h1 style="text-align:center;">Dear ${userName},
          Thank you for updating your profile with AONE. To complete the process, we need you to verify your
          email address. Simply click on the link below to confirm:
          </h1>
          <p>Thanks for updating profile. please verify your email address by clicking the button below:</p>
          <table align="center" style="margin: 20px auto;">
            <tr>
              <td>
                <a href="${verification_link}" style="background-color: #4CAF50; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 18px; text-decoration: none;">
                Verify My Email
                </a>
              </td>
            </tr>
          </table>
          <p>If you encounter any issues during this process or if you did not initiate an update to your
          account, please reach out to us directly at <a href="mailto:${process.env.COMPANY_EMAIL}">${process.env.COMPANY_EMAIL}</a> Our support team is ready to assist you with
          any concerns.
          </p>
          <p><b>In case you did not sign up for an account with AONE, please ignore this email and refrain from
          clicking the verification link. We apologize for any inconvenience and appreciate your
          understanding.</b>
          </p>
          <p>Best regards,</p>
          <p>AONE Gold Team</p>
        </td>
      </tr>
    </table>
  </body>
  </html>  
  `;
}

function greeting_template(userName) {
  return {
    subject: "Welcome to AONE - Your Registration is Confirmed!",
    body: `<!DOCTYPE html>
      <html>
      <head>
        <title>Welcome</title>
      </head>
      <body>
        <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #fff; border-collapse: collapse;">
          <tr>
            <td style="padding: 20px;">
              <h2 style="text-align:center;">Dear ${userName}</h2>
              <p>We are delighted to confirm your successful registration with us.</p>
              <p>Welcome aboard! It's fantastic to have you with us, and we're eager to see what you'll
              accomplish.
              </p>
              <p>If this registration was not initiated by you, please disregard this email.</p>
              <p>Best regards,</p>
              <p>AONE Gold Team
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };
}

function reset_password_template(reset_password_link) {
  return `<!DOCTYPE html>
  <html>
  <head>
    <title>Reset Password</title>
  </head>
  <body>
    <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #fff; border-collapse: collapse;">
      <tr>
        <td style="padding: 20px;">
          <h1 style="text-align:center;">Reset Password</h1>
          <p>We received a request to reset the password for your account. If you made this request, click the button below to reset your password:</p>
          <table align="center" style="margin: 20px auto;">
            <tr>
              <td>
                <a href="${reset_password_link}" style="background-color: #4CAF50; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 18px; text-decoration: none;">
                  Reset Password
                </a>
              </td>
            </tr>
          </table>
          <p>If you didn't make this request, you can safely ignore this email.</p>
          <p>Best regards,</p>
          <p>The Team</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;
}

module.exports = {
  verification_template,
  reset_password_template,
  greeting_template,
};
