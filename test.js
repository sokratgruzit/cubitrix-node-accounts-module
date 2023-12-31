const express = require("express");
const mongoose = require("mongoose");
const router = require("./routes/index");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");
const cors_options = require("./config/cors_options");
const isAuthenticated = require("./middleware/IsAuthenticated");
const cookieParser = require("cookie-parser");
const decryptEnv = require("./utils/decryptEnv");

const MONGO_URL = process.env.MONGO_URL;
const mongoUrl = decryptEnv(MONGO_URL);
// const { update_current_rates, get_rates } = require("./controllers/accounts_controller");

const app = express();
require("dotenv").config();

app.use(express.json({extended: true}));
app.use(cookieParser());
app.use(isAuthenticated);

app.use(cors(cors_options));
app.use("/api/accounts", router);

// console.log(accounts.index("jinx1"));
// app.use('/accounts', router)

// const auth = require('./modules/auth/routes/index.routes');
// const staking = require('./modules/staking/routes/index.routes');

//load modules depend env file
// if(process.env.AUTH === 'true') app.use('/api/auth', auth);
// if(process.env.STAKING === 'true') app.use('/api/staking', staking);

// //test route
// app.get("/test", (req, res) => {
//    res.send("server is working");
// });

//static path
const root = require("path").join(__dirname, "front", "build");
app.use(express.static(root));
// app.get("*", function (req, res) {
//    res.sendFile(
//       'index.html', { root }
//    );
// });

// setInterval(async () => {
//   update_current_rates();
//   get_rates();
// }, 3000);

async function start() {
  const PORT = process.env.PORT || 4000;
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    app.listen(PORT, () =>
      console.log(`App has been started on port ${PORT}...`)
    );
  } catch (e) {
    console.log(`Server Error ${e.message}`);
    process.exit(1);
  }
}

start();
