// const accounts = require("../models/accounts/accounts");
const accounts = require("../models/accounts/accounts");
const account_meta = require("../models/accounts/account_meta");
const account_auth = require("../models/accounts/account_auth");
const account_types = require("../models/accounts/account_types");
const main_helper = require("../helpers/index");
require("dotenv").config();

function index(name){
  return name;
}

async function login_account (req, res) {
  console.log("123");
  try{
    let {address, balance }  = req.body; 
    console.log(address, balance);
    if(!address && !balance){
      return main_helper.error_response(res, main_helper.error_message("fill all fields"));
    }
    let type_id = await get_type_id("user_current");
    let account_exists = await check_account_exists(address, type_id);
    if(account_exists.success){
      return main_helper.success_response(res, account_exists);
    }
    let account_saved = await save_account(address, type_id, balance, "user", "");
    if(account_saved.success){
      return main_helper.success_response(res, account_saved);
    }
    return main_helper.error_response(res, account_exists);


  }catch(e){
   return main_helper.error_response(res, main_helper.error_message(e.message));
  }
};

async function save_account(address, type_id, balance, account_category, account_owner){  
  try{
    let save_user = await accounts.create({
          address:address,
          type_id:type_id,
          balance:balance,
          account_category:account_category,
          account_owner:account_owner
        });
    if(save_user){
      return main_helper.success_message("user saved");
    }
    return main_helper.error_message("error while saving user");
  }catch(e){
    return main_helper.error_message(e.message);
  }

}

async function get_type_id (type_name) {
  try{
    let type = await account_types.findOne({name:type_name}, {_id}); 
    if(type){
      return type._id;
    }
   return 0;
  }catch(e){
   return main_helper.error_message(e.message);
  }
};

async function check_account_exists (address, type_id) {
  try{
    let account =  await accounts.findOne({address:address,account_type_id:type_id });
    if(account){
      return main_helper.success_message("account found");
    }else{
      return main_helper.error_message("Problem checking user");
    }
  }catch(e){
   return main_helper.error_message(e.message);
  }
};

module.exports = {
  index,
  login_account
};
