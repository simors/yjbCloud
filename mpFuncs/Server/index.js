/**
 * Created by wanpeng on 2017/7/15.
 */
var Promise = require('bluebird');
var wechat = require('wechat');
var AV = require('leanengine');
var GLOBAL_CONFIG = require('../../config')
var utilFunc = require('../../cloudFuncs/util')

var wechat_api = require('../index').wechat_api


function wechatServer(req, res, next) {
  var message = req.weixin;
  console.log('weixin  message:', message)

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