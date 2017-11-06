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
  }).then(() => {
    let updateUserScore = require('../../cloudFuncs/Score').updateUserScore
    let SCORE_OP_TYPE_FOCUS = require('../../cloudFuncs/Score').SCORE_OP_TYPE_FOCUS
    return updateUserScore(userId, SCORE_OP_TYPE_FOCUS, {})
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
      } else {
        res.reply({
          type: 'text',
          content: ''
        })
      }
      break
    default:
      res.reply({
        type: 'text',
        content: ''
      })
      break
  }
}

var mpServerFuncs = {
  wechatServer: wechatServer,
}

module.exports = mpServerFuncs