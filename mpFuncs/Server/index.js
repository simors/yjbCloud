/**
 * Created by wanpeng on 2017/7/15.
 */
var Promise = require('bluebird');
var wechat = require('wechat');
var AV = require('leanengine');
var GLOBAL_CONFIG = require('../../config')
var utilFunc = require('../../cloudFuncs/Util')
var authFunc = require('../../cloudFuncs/Auth')

//用户关注事件处理
function subscribeEvent(req, res, next) {
  var message = req.weixin
  var openid = message.FromUserName

  authFunc.updateUserSubscribe(openid, true).then((result) => {
    if(result) {
      res.reply({
        type: 'text',
        content: "欢迎回来"
      })
    } else {
      res.reply({
        type: 'text',
        content: "欢迎使用衣家宝干衣柜"
      })
    }
  }).catch((error) => {
    console.log("subscribeEvent error", error)
    res.reply({
      type: 'text',
      content: "服务器异常，请联系客服！"
    })
  })


}

//用户取消关注事件处理
function unsubscribeEvent(req, res, next) {
  let message = req.weixin
  let openid = message.FromUserName

  authFunc.updateUserSubscribe(openid, false).catch((error) => {
    console.log("unsubscribeEvent error", error)
  })
}

//扫码开柜事件处理
function scanEvent(req, res, next) {
  var message = req.weixin
  // console.log("扫码开柜消息：", message)
  var openid = message.FromUserName
  var deviceNo = message.EventKey

  authFunc.isUserSignIn(openid).then((result) => {
    if(result) {
      res.reply({
        type: 'text',
        content: "<a href='" + GLOBAL_CONFIG.MP_CLIENT_DOMAIN + "/openDevice/" + deviceNo + "'>开柜使用</a>"
      })
    } else {
      res.reply({
        type: 'text',
        content: "<a href='" + GLOBAL_CONFIG.MP_CLIENT_DOMAIN + "/bind?deviceNo=" + deviceNo + "'>绑定手机号码</a>" +"使用衣家宝干衣柜。"
      })
    }
  }).catch((error) => {
    console.log("scanEvent error", error)
    res.reply({
      type: 'text',
      content: "服务器异常，请联系客服！"
    })
  })
}


function wechatServer(req, res, next) {
  var message = req.weixin;
  console.log("收到微信消息：", message)

  switch (message.MsgType) {
    case 'text':
      res.reply({
        type: 'text',
        content: '欢迎'
      })
      break;
    case 'event':
      if(message.Event === 'CLICK') {

      } else if(message.Event === 'subscribe') {
        subscribeEvent(req, res, next)
      } else if(message.Event === 'unsubscribe') {
        unsubscribeEvent(req,res, next)
      } else if(message.Event === 'SCAN') {
        scanEvent(req, res, next)
      }
      break
    default:
      break
  }
}

var mpServerFuncs = {
  wechatServer: wechatServer,
}

module.exports = mpServerFuncs