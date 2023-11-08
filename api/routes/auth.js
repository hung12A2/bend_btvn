const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validInput = require('../utils/validInput');
const verify = require('../utils/verifyToken');
const { responseError, callRes } = require('../response/error');

// Item Model
const User = require("../models/User");
const Setting = require("../models/Setting");
const verifyToken = require('../utils/verifyToken');


router.get('/verifyToken', verifyToken, async (req, res) => {
  try {

    const { token } = req.query;
    const verified = jwt.verify(token, process.env.jwtSecret);
    User.findById(verified.id, (err, user) => {
      const data = {
        id: verified.id,
        username: user.name,
        phoneNumber: user.phoneNumber,
        avatar: user.avatar.url ? user.avatar.url : null,
        active: null,
        token: token
      }
      return callRes(res, responseError.OK, data);
    });
  }
  catch (error) {
    return callRes(res, responseError.UNKNOWN_ERROR, error.message);
  }
});
router.post('/checkexistphonenumber', async (req, res) => {
  const phoneNumber = req.query.phonenumber;
  if (phoneNumber === undefined) {
    return callRes(res, responseError.PARAMETER_IS_NOT_ENOUGH, 'phoneNumber');
  }
  if (!validInput.checkPhoneNumber(phoneNumber)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'phoneNumber');
  }
  let user = await User.findOne({ phoneNumber });
  try {
    const data = {
      message: '',
      isExisted: true
    }
    if (user) {
      data.message = 'phoneNumber is existed';
      return callRes(res, responseError.OK, data);
    }
    data.isExisted = false;
    return callRes(res, responseError.OK, data);
  }
  catch (error) {
    return callRes(res, responseError.UNKNOWN_ERROR, error.message);
  }
});
router.post('/signup', async (req, res) => {
  const { password, name, birthday } = req.query;
  let phoneNumber = req.query.phonenumber;

  if (phoneNumber === undefined || password === undefined || name === undefined || birthday === undefined) {
    return callRes(res, responseError.PARAMETER_IS_NOT_ENOUGH, 'phoneNumber, password, name, birthday');
  }
  if (typeof phoneNumber != 'string' || typeof password != 'string' || typeof name != 'string') {
    return callRes(res, responseError.PARAMETER_TYPE_IS_INVALID, 'phoneNumber, password, name');
  }
  if (!validInput.checkPhoneNumber(phoneNumber)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'phoneNumber');
  }
  if (!validInput.checkUserPassword(password)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'password');
  }
  if (phoneNumber == password) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'trùng phone và pass');
  }
  try {
    let user = await User.findOne({ phoneNumber });
    if (user) return callRes(res, responseError.USER_EXISTED);
    const newUser = new User({
      phoneNumber,
      password,
      name,
      birthday: new Date(birthday),
      verifyCode: random4digit(),
      isVerified: false
    });
    // hash the password before save to DB
    bcrypt.genSalt(10, (err, salt) => {
      if (err) return callRes(res, responseError.UNKNOWN_ERROR, err.message);
      bcrypt.hash(newUser.password, salt, async (err, hash) => {
        if (err) return callRes(res, responseError.UNKNOWN_ERROR, err.message);
        newUser.password = hash;
        try {
          let saved = await newUser.save();

          // add default settings
          await new Setting({
            user: saved.id
          }).save()

          let data = {
            id: saved.id,
            phoneNumber: saved.phoneNumber,
            verifyCode: saved.verifyCode,
            isVerified: saved.isVerified
          }
          return callRes(res, responseError.OK, data);
        } catch (error) {
          return callRes(res, responseError.CAN_NOT_CONNECT_TO_DB, error.message);
        }
      })
    })
  } catch (error) {
    return callRes(res, responseError.UNKNOWN_ERROR, error.message);
  }
})


// @route  POST it4788/get_verify_code
// @desc   get verified code
// @access Public
router.post('/get_verify_code', async (req, res) => {
  const { phonenumber } = req.query;

  if (!phonenumber) {
    console.log("PARAMETER_IS_NOT_ENOUGH phonenumber");
    return callRes(res, responseError.PARAMETER_IS_NOT_ENOUGH, 'phonenumber');
  }

  if (phonenumber && typeof phonenumber != 'string') {
    return callRes(res, responseError.PARAMETER_TYPE_IS_INVALID, 'phonenumber');
  }
  if (!validInput.checkPhoneNumber(phonenumber)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'phonenumber');
  }

  try {
    let user = await User.findOne({ phoneNumber: phonenumber });
    if (!user) {
      console.log("phonenumber is not existed");
      return callRes(res, responseError.USER_IS_NOT_VALIDATED, 'phonenumber is not existed');
    }

    if (user.isVerified) {
      console.log("user is verified");
      return callRes(res, responseError.ACTION_HAS_BEEN_DONE_PREVIOUSLY_BY_THIS_USER, 'user is verified');
    }

    if (user.timeLastRequestGetVerifyCode) {
      let time = (Date.now() - user.timeLastRequestGetVerifyCode) / 1000;
      console.log(time);
      if (time < 120) {
        console.log("2 lan lay get verify gan nhau < 120s");
        return callRes(res, responseError.ACTION_HAS_BEEN_DONE_PREVIOUSLY_BY_THIS_USER, (120 - time));
      }
    }

    user.timeLastRequestGetVerifyCode = Date.now();
    await user.save();

    let data = {
      verifyCode: user.verifyCode
    }
    return callRes(res, responseError.OK, data);
  } catch (err) {
    console.log(err);
    console.log("CAN_NOT_CONNECT_TO_DB");
    return callRes(res, responseError.CAN_NOT_CONNECT_TO_DB);
  }
});


// @route  POST it4788/check_verify_code
// @desc   check verified code
// @access Public
router.post('/check_verify_code', async (req, res) => {
  const { phonenumber, code_verify } = req.query;

  if (!phonenumber || !code_verify) {
    return callRes(res, responseError.PARAMETER_IS_NOT_ENOUGH, 'phonenumber, code_verify');
  }
  if (typeof phonenumber != 'string' || typeof code_verify != 'string') {
    return callRes(res, responseError.PARAMETER_TYPE_IS_INVALID, 'phonenumber, code_verify');
  }
  if (!validInput.checkPhoneNumber(phonenumber)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'phonenumber');
  }
  if (!validInput.checkVerifyCode(code_verify)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'code_verify');
  }

  try {
    let user = await User.findOne({ phoneNumber: phonenumber });
    if (!user) {
      console.log("phonenumber is not existed");
      return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'phonenumber is not existed');
    }

    if (user.isVerified) {
      console.log("user is verified");
      return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'user is verified');
    }

    if (user.verifyCode != code_verify) {
      console.log("code_verify sai");
      return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'code_verify is wrong');
    }

    user.isVerified = true;
    user.verifyCode = undefined;
    user.dateLogin = Date.now();
    let loginUser = await user.save();

    try {
      var token = jwt.sign(
        { id: loginUser.id, dateLogin: loginUser.dateLogin },
        process.env.jwtSecret,
        { expiresIn: 86400 });
      let data = {
        token: token,
        id: user._id,
        username: (loginUser.name) ? loginUser.name : null,
        active: null,
        avatar: (loginUser.avatar.url) ? loginUser.avatar.url : null,
      }
      return callRes(res, responseError.OK, data);
    } catch (err) {
      console.log(err);
      return callRes(res, responseError.UNKNOWN_ERROR, err.message);
    }
  } catch (err) {
    console.log(err);
    console.log("CAN_NOT_CONNECT_TO_DB");
    return callRes(res, responseError.CAN_NOT_CONNECT_TO_DB);
  }
});


// @route  POST it4788/login
// @desc   login
// @access Public
router.post('/login', async (req, res) => {
  const { password } = req.query;
  let phoneNumber = req.query.phonenumber;
  if (phoneNumber === undefined || password === undefined) {
    return callRes(res, responseError.PARAMETER_IS_NOT_ENOUGH, 'phoneNumber, password');
  }
  if (typeof phoneNumber != 'string' || typeof password != 'string') {
    return callRes(res, responseError.PARAMETER_TYPE_IS_INVALID, 'phoneNumber, password');
  }
  if (!validInput.checkPhoneNumber(phoneNumber)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'phoneNumber');
  }
  if (!validInput.checkUserPassword(password)) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'password');
  }
  if (phoneNumber == password) {
    return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'trùng phone và pass');
  }
  try {
    // check for existing user
    let user = await User.findOne({ phoneNumber });
    if (!user) return callRes(res, responseError.USER_IS_NOT_VALIDATED, 'không có user này');
    bcrypt.compare(password, user.password)
      .then(async (isMatch) => {
        if (!isMatch) return callRes(res, responseError.PARAMETER_VALUE_IS_INVALID, 'password');
        if (!user.isVerified) return callRes(res, responseError.USER_IS_NOT_VALIDATED, 'chưa xác thực code verify');
        user.dateLogin = Date.now();
        try {
          let loginUser = await user.save();
          jwt.sign(
            { id: loginUser.id, dateLogin: loginUser.dateLogin },
            process.env.jwtSecret,
            { expiresIn: 86400 },
            (err, token) => {
              if (err) return callRes(res, responseError.UNKNOWN_ERROR, err.message);
              let data = {
                id: loginUser.id,
                phoneNumber: phoneNumber,
                username: (loginUser.name) ? loginUser.name : null,
                token: token,
                avatar: (loginUser.avatar.url) ? loginUser.avatar.url : null,
                active: null
              }
              return callRes(res, responseError.OK, data);
            }
          )
        } catch (error) {
          return callRes(res, responseError.UNKNOWN_ERROR, error.message);
        }
      })
  } catch (error) {
    return callRes(res, responseError.UNKNOWN_ERROR, error.message);
  }
})


// @route  POST it4788/logout
// @desc   logout
// @access Public
router.post("/logout", verify, async (req, res) => {
  try {
    let user = await User.findById(req.user.id);
    user.dateLogin = "";
    await user.save();
    return callRes(res, responseError.OK);
  } catch (error) {
    return callRes(res, responseError.UNKNOWN_ERROR, error.message);
  }
})

module.exports = router;
