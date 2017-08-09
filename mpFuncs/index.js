/**
 * Created by wanpeng on 2017/8/9.
 */
var WechatAPI = require('wechat-api')
var OAuth = require('wechat-oauth');
var GLOBAL_CONFIG = require('../config')
var mpTokenFuncs = require('./Token')

var wechat_api = new WechatAPI(GLOBAL_CONFIG.WECHAT_MP_APPID, GLOBAL_CONFIG.WECHAT_MP_APPSECRET, mpTokenFuncs.getApiTokenFromRedis, mpTokenFuncs.setApiTokenToRedis)

var oauth_client = new OAuth(GLOBAL_CONFIG.WECHAT_MP_APPID, GLOBAL_CONFIG.WECHAT_MP_APPSECRET, mpTokenFuncs.getOauthTokenFromMysql, mpTokenFuncs.setOauthTokenToMysql);

module.exports = {
  wechat_api,
  oauth_client,
}