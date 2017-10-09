/**
 * Created by wanpeng on 2017/8/7.
 */
var AV = require('leanengine');
var mpAuthFuncs = require('../../mpFuncs/Auth')
var PingppFunc = require('../Pingpp')
var Promise = require('bluebird')

function constructUserInfo(user) {
  if(!user) {
    return undefined
  }
  var userAttr = user.attributes
  if(!userAttr) {
    return undefined
  }

  var userInfo = {}
  userInfo.id = user.id
  userInfo.nickname = userAttr.nickname
  userInfo.sex = userAttr.sex
  userInfo.country = userAttr.country
  userInfo.province = userAttr.province
  userInfo.city = userAttr.city
  userInfo.idNumber = userAttr.idNumber
  userInfo.idName = userAttr.idName
  userInfo.mobilePhoneNumber = userAttr.mobilePhoneNumber
  userInfo.language = userAttr.language
  userInfo.avatar = userAttr.avatar

  return userInfo
}

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

function fetchDealRecords(request, response) {
  console.log("fetchDealRecords params:", request.params)
  var userId = request.params.userId
  var limit = request.params.limit || 10
  var lastTime = request.params.lastTime

  PingppFunc.getUserDealRecords(userId, limit, lastTime).then((records) => {
    response.success(records)
  }).catch((error) => {
    console.log("fetchDealRecords", error)
    response.error(error)
  })
}

function verifyIdName(request, response) {
  var userId = request.params.userId
  var idName = request.params.idName
  var idNumber = request.params.idNumber

  var user = AV.Object.createWithoutData('_User', userId)

  user.set('idName', idName)
  user.set('idNumber', idNumber)
  user.set('idNameVerified', false)

  user.save().then((leanUser) => {
    var idInfo = {
      userId: leanUser.id,
      idName: leanUser.attributes.idName,
      idNumber: leanUser.attributes.idNumber,
    }
    response.success(idInfo)
  }).catch((error) => {
    console.log("verifyUsername", error)
    response.error(error)
  })
}

async function getUserId(mobilePhoneNumber) {
  let userId = undefined
  let query = new AV.Query('_User')
  query.equalTo('mobilePhoneNumber', mobilePhoneNumber)
  let user = await query.first()
  userId = user? user.id: undefined
  return userId
}

async function getUserInfoById(userId) {
  if(!userId) {
    return undefined
  }
  let user = AV.Object.createWithoutData('_User', userId)
  if(!user) {
    return undefined
  }
  let userInfo = await user.fetch()
  return constructUserInfo(userInfo)
}

async function authFuncTest(request, response) {
  let userId = request.params.userId
  let userInfo = await getUserInfoById(userId)
  response.success(userInfo)
}

var authFunc = {
  constructUserInfo: constructUserInfo,
  fetchUserInfo: fetchUserInfo,
  authFuncTest: authFuncTest,
  isUserSignIn: isUserSignIn,
  fetchWalletInfo: fetchWalletInfo,
  fetchDealRecords: fetchDealRecords,
  verifyIdName: verifyIdName,
  getUserId: getUserId,
  getUserInfoById: getUserInfoById,
}

module.exports = authFunc