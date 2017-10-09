/**
 * Created by wanpeng on 2017/10/9.
 */
var GLOBAL_CONFIG = require('../../config')
var wechat_api = require('../index').wechat_api

function isSubscribe(request, response) {
  let openid = request.params.openid

  wechat_api.getUser(openid, function (err, result) {
    if(err) {
      console.error(err)
      response.error(err)
      return
    }
    let subscribe = result.subscribe
    response.success(subscribe)
  })
}

var mpUserFuncs = {
  isSubscribe: isSubscribe,
}

module.exports = mpUserFuncs