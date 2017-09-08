/**
 * Created by wanpeng on 2017/9/4.
 */
var GLOBAL_CONFIG = require('../../config')
var Promise = require('bluebird')
var wechat_api = require('../index').wechat_api


function getWechatJsSdkConfig(request, response) {
  var param = {
    debug: true,
    jsApiList: ['scanQRCode'],
    url: 'http://dev.yiijiabao.com'
  }

  wechat_api.getJsConfig(param, function (err, result) {
    if(err) {
      console.log("getWechatJsSdkConfig", err)
      response.error(err)
    } else {
      response.success(result)
    }
  })
}


var mpJsSdkFuncs = {
  getJsConfig: getWechatJsSdkConfig,
}

module.exports = mpJsSdkFuncs

