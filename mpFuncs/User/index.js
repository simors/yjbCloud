/**
 * Created by wanpeng on 2017/11/11.
 */
var Promise = require('bluebird')
var wechat_api = require('../index').wechat_api

function getWechatUserInfo(openid) {
  if(!openid) {
    return undefined
  }
  return new Promise((resolve, reject) => {
    wechat_api.getUser(openid, function (err, result) {
      if(err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

var mpUserFuncs = {
  getWechatUserInfo: getWechatUserInfo,
}

module.exports = mpUserFuncs