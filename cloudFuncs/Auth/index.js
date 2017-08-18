/**
 * Created by wanpeng on 2017/8/7.
 */
var AV = require('leanengine');
var mpAuthFuncs = require('../../mpFuncs/Auth')

function fetchWechatUserInfo(request, response) {
  console.log("fetchWechatUserInfo params", request.params)
  var code = request.params.code
  var accessToken = undefined
  var expires_in = undefined

  mpAuthFuncs.getAccessToken(code).then((result) => {
    var openid = result.data.openid
    accessToken = result.data.access_token;
    expires_in = result.data.expires_in

    return mpAuthFuncs.getUserInfo(openid)
  }).then((userInfo) => {
    userInfo.accessToken = accessToken
    userInfo.expires_in = expires_in
    response.success(userInfo)
  }).catch((error) => {
    console.log("fetchWechatUserInfo::", error)
    response.error(error)
  })
}

function isUserSignIn(openid) {
  var query = new AV.Query('_User')
  query.equalTo("authData.weixin.openid", openid)
  return query.find().then((result) => {
    if(result.length >= 1) {
      return true
    } else {
      return false
    }
  }).catch((error) => {
    throw error
  })
}

function authFuncTest(request, response) {
  let message = "测试成功"

  response.success({
    message: message
  })
}

var authFunc = {
  fetchWechatUserInfo: fetchWechatUserInfo,
  authFuncTest: authFuncTest,
  isUserSignIn: isUserSignIn,
}

module.exports = authFunc