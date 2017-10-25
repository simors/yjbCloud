/**
 * Created by wanpeng on 2017/7/26.
 */
import AV from 'leanengine'
var wechat_api = require('../index').wechat_api
var Promise = require('bluebird');
import * as errno from '../../cloudFuncs/errno'


function createLimitQRCode(sceneId) {
  return new Promise(function (resolve, reject) {
    wechat_api.createLimitQRCode(sceneId, function (err, result) {
      if(err) {
        console.log("createLimitQRCode", err)
        reject(new Error("创建永久二维码失败"))
        return
      }
      var ticket = result.ticket
      var qrcodeUrl = wechat_api.showQRCodeURL(ticket)
      resolve(qrcodeUrl)
    })
  })
}

function createTmpQRCode(sceneId, expire_seconds) {
  return new Promise(function (resolve, reject) {
    wechat_api.createTmpQRCode(sceneId, expire_seconds, function (err, result) {
      if(err) {
        console.log("createTmpQRCode", err)
        reject(new Error("创建临时二维码失败"))
        return
      }
      var ticket = result.ticket
      var qrcodeUrl = wechat_api.showQRCodeURL(ticket)
      resolve(qrcodeUrl)
    })
  })
}

async function reqGenerateUserQRCode(request) {
  let phone = request.params.phone
  try {
    let qrcodeUrl = await createTmpQRCode(phone, 24 * 3600 * 2)
    return qrcodeUrl
  } catch (e) {
    throw new AV.Cloud.Error('Query admin profit error', {code: errno.EIO})
  }
}

var mpQrcodeFuncs = {
  createLimitQRCode: createLimitQRCode,
  createTmpQRCode: createTmpQRCode,
  reqGenerateUserQRCode,
}

module.exports = mpQrcodeFuncs