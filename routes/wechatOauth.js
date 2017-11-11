/**
 * Created by wanpeng on 2017/10/12.
 */
'use strict'
var AV = require('leanengine')
var router = require('express').Router()
var mpAuthFuncs = require('../mpFuncs/Auth')
var GLOBAL_CONFIG = require('../config')
var querystring = require('querystring')
var authFunc = require('../cloudFuncs/Auth')
import utilFunc from '../cloudFuncs/Util'
import authApi, {AUTH_USER_TYPE} from '../cloudFuncs/Auth/User'

async function createUserByAuthData(authData, phone, clientIp) {
  let platform = 'weixin'
  let openid = authData.openid
  let userAddrInfo = undefined
  if(clientIp) {
    userAddrInfo = await utilFunc.getIpInfo(clientIp)
  }
  let isSignIn = await authFunc.isUserSignIn(openid)
  if(!isSignIn) {
    let user = new AV.User()
    let userWechatInfo = await mpAuthFuncs.getUserInfo(openid)
    user.set('nickname', userWechatInfo.nickname)
    user.set('avatar', userWechatInfo.headimgurl)
    user.set('sex', userWechatInfo.sex)
    user.set('language', userWechatInfo.language)
    if (phone) {
      user.set('mobilePhoneNumber', phone)
      user.set('mobilePhoneVerified', true)
    }
    if(userAddrInfo) {
      user.set('country', {label: userAddrInfo.country, value: userAddrInfo.country_id})
      user.set('province', {label: userAddrInfo.region, value: userAddrInfo.region_id})
      user.set('city', {label: userAddrInfo.city, value: userAddrInfo.city_id})
    }
    user.set('subscribe', userWechatInfo.subscribe)
    user.set('type', AUTH_USER_TYPE.END)
    user.set('score', 0)

    //创建钱包信息
    let createUserWallet = require('../cloudFuncs/Pingpp').createUserWallet
    let leanUser = await AV.User.associateWithAuthData(user, platform, authData)
    createUserWallet(leanUser.id, openid)
    return leanUser
  }
  return authApi.authFetchUserByOpenId(openid)
}

router.get('/', async function (req, res, next) {
  var code = req.query.code
  var state = req.query.state
  var redirectUrl = ''
  var clientIp = utilFunc.getClientIp(req)

  try {
    let result = await mpAuthFuncs.getAccessToken(code)
    let openid = result.data.openid
    let accessToken = result.data.access_token
    let expires_in = result.data.expires_in
    let authData = {
      "openid": openid,
      "access_token": accessToken,
      "expires_at": Date.parse(expires_in),
    }
    await createUserByAuthData(authData, undefined, clientIp)
    redirectUrl =  GLOBAL_CONFIG.MP_CLIENT_DOMAIN + state + '?' + querystring.stringify(authData)
  } catch (error) {
    console.error(error)
    redirectUrl = GLOBAL_CONFIG.MP_CLIENT_DOMAIN + ''
  }
  res.redirect(redirectUrl)
})

router.get('/adminUserAuth', async function (req, res, next) {
  var code = req.query.code
  var state = req.query.state
  var redirectUrl = ''
  var clientIp = utilFunc.getClientIp(req)

  try {
    let result = await mpAuthFuncs.getAccessToken(code)
    let openid = result.data.openid
    let accessToken = result.data.access_token
    let expires_in = result.data.expires_in
    let authData = {
      "openid": openid,
      "access_token": accessToken,
      "expires_at": Date.parse(expires_in),
    }
    let phone = state
    await createUserByAuthData(authData, phone, clientIp)
    redirectUrl =  GLOBAL_CONFIG.MP_CLIENT_DOMAIN + '/authSuccess?' + querystring.stringify(authData)
  } catch (error) {
    console.error(error)
    redirectUrl = GLOBAL_CONFIG.MP_CLIENT_DOMAIN + ''
  }
  res.redirect(redirectUrl)
})

module.exports = router
