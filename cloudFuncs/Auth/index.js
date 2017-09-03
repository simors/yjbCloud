/**
 * Created by wanpeng on 2017/8/7.
 */
var AV = require('leanengine');
var mpAuthFuncs = require('../../mpFuncs/Auth')
var PingppFunc = require('../Pingpp')


function fetchUserInfo(request, response) {
  console.log("fetchUserInfo params", request.params)
  var code = request.params.code
  var openid = undefined
  var accessToken = undefined
  var expires_in = undefined
  var isBind = false

  mpAuthFuncs.getAccessToken(code).then((result) => {
    openid = result.data.openid
    accessToken = result.data.access_token
    expires_in = result.data.expires_in

    return isUserSignIn(openid)
  }).then((result) => {
    isBind = result
    return mpAuthFuncs.getUserInfo(openid)
  }).then((userInfo) => {
    userInfo.isBind = isBind
    userInfo.accessToken = accessToken
    userInfo.expires_in = expires_in

    response.success(userInfo)
  }).catch((error) => {
    console.log("fetchUserInfo::", error)
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

function fetchWalletInfo(request, response) {
  var userId = request.params.userId

  PingppFunc.getWalletInfo(userId).then((walletInfo) => {
    response.success(walletInfo)
  }).catch((error) => {
    console.log("fetchWalletInfo", error)
    response.error(error)
  })

}

function authFuncTest(request, response) {
  let message = "测试成功"

  response.success({
    message: message
  })
}

var authFunc = {
  fetchUserInfo: fetchUserInfo,
  authFuncTest: authFuncTest,
  isUserSignIn: isUserSignIn,
  fetchWalletInfo: fetchWalletInfo,
}

module.exports = authFunc