/**
 * Created by wanpeng on 2017/9/4.
 */
var Promise = require('bluebird')
var GLOBAL_CONFIG = require('../../config')
var wechat_api = require('../index').wechat_api

/**
 * 发送开锁成功模板消息
 * @param {String} openid 用户的openid
 * @param {Number} amount 打赏金额
 * @param {String} title 文章标题
 * @param {Date} created 打赏时间
 */
function sendTurnOnTmpMsg(openid, ) {
  var templateId = GLOBAL_CONFIG.WECHAT_MSG_TMPID_TURNON
  var url = ""

  var data = {
    "first": {
      "value":"恭喜您收到新的打赏！\n",
      "color":"#173177"
    },
    // "keyword1": {
    //   "value": rewardArticle,
    //   "color":"#173177"
    // },
    // "keyword2" : {
    //   "value": rewardAmount,
    //   "color":"#173177"
    // },
    // "keyword3" : {
    //   "value": rewardTime,
    //   "color":"#173177"
    // },
    "remark":{
      "value":"\n如有问题请在汇邻优店公众号内留言，小汇将第一时间为您服务！",
      "color":"#173177"
    }
  }

  return new Promise((resolve, reject) => {
    wechat_api.sendTemplate(openid, templateId, url, data, function (err, result) {
      if(!err) {
        return resolve()
      } else {
        return reject()
      }
    })
  })
}



function wechatMessageTest(request, response) {
  console.log("wechatMessageTest", request.params)
  var openid = request.params.openid
  var username = request.params.username
  var city = request.params.city

  // sendTurnOnTmpMsg(openid, username, city).then(() => {
  //   response.success({
  //
  //   })
  // }).catch((error) => {
  //   console.log("sendInviterTmpMsg", error)
  // })
}


var mpMsgFuncs = {
  sendTurnOnTmpMsg: sendTurnOnTmpMsg,
  wechatMessageTest: wechatMessageTest
}

module.exports = mpMsgFuncs