const express = require('express');
const router = express.Router();
const {responseError, callRes} = require('../response/error');
const validTime = require('../utils/validTime');
const User = require('../models/User');
const {getUserIDFromToken} = require('../utils/getUserIDFromToken');


router.post ('/get_user_info', async (req, res) => {
  let { token, user_id } = req.query;
  let tokenUser, tokenError;
  if (token) {
    tokenUser = await getUserIDFromToken(token);
    if (tokenUser && typeof tokenUser === 'string') return callRes(res, responseError[tokenUser]);
  }
  if (!user_id && tokenUser ) {
    user_id = tokenUser.id;
  }
  else {
    if (user_id && typeof user_id != 'string')
      return callRes(res, responseError.PARAMETER_TYPE_IS_INVALID, 'user_id');
  }
  if (!user_id) return callRes(res, responseError.PARAMETER_IS_NOT_ENOUGH)
  let user;
  let data = {
    id: null,
    username: null,
    created: null,
    description: null,
    avatar: null,
    cover_image: null,
    link: null,
    address: null,
    city: null,
    country: null,
    listing: null,
    is_friend: null,
    online: null
  }
  try {
    user = await User.findById(user_id);
    if (!user) return callRes(res, responseError.NO_DATA_OR_END_OF_LIST_DATA, 'user');
    if (tokenUser && user_id != tokenUser.id && user.blockedList ) {
      let index = user.blockedList.findIndex(element => element.user._id.equals(tokenUser.id));
      if (index >= 0) return callRes(res, responseError.USER_IS_NOT_VALIDATED, 'bị block rồi em ơi, khổ quá');
      let index1 = tokenUser.blockedList.findIndex(element => element.user._id.equals(user.id));
      if (index1 >= 0) return callRes(res, responseError.USER_IS_NOT_VALIDATED, 'bị block rồi em ơi, khổ quá');

    }
    data.id = user._id.toString();
    data.username = user.name;
    data.created = validTime.timeToSecond(user.createdAt);
    data.description = user.description;
    data.avatar= user.avatar.url;
    data.cover_image = user.coverImage.url;
    data.link = user.link;
    data.address = user.address;
    data.city = user.city;
    data.country = user.country;
    data.birthday = validTime.timeToSecond(user.birthday);
    data.listing = user.friends.length;
    data.is_friend = false;
    if (tokenUser && user_id != tokenUser.id) {
      let indexExist = user.friends.findIndex(element => element.friend._id.equals(tokenUser.id)); 
      data.is_friend =  (indexExist >= 0) ? true : false;
    }
    return callRes(res, responseError.OK, data);
  } catch (error) {
    return callRes(res, responseError.UNKNOWN_ERROR, error.message);
  }
});

module.exports = router;


