/**
 * Created by wanpeng on 2017/8/22.
 */
var AV = require('leanengine');
var Promise = require('bluebird')
var mpQrcodeFuncs = require('../../mpFuncs/Qrcode')

//设备状态
const IDLE = 0        //空闲
const OCCUPIED = 1    //使用中
const OFFLINE = 2     //下线

function constructDeviceInfo(device) {
  var deviceInfo = {}
  deviceInfo.id = device.id
  deviceInfo.deviceNo = device.attributes.deviceNo
  deviceInfo.status = device.attributes.status
  deviceInfo.unitPrice = device.attributes.unitPrice
  deviceInfo.deviceAddr = device.attributes.deviceAddr
  deviceInfo.onlineTime = device.attributes.onlineTime.valueOf()
  deviceInfo.updateTime = device.attributes.updateTime.valueOf()

  return deviceInfo
}

function fetchDeviceInfo(request, response) {
  var deviceNo = request.params.deviceNo

  if(!deviceNo) {
    response.error(new Error("无效到设备id"))
    return
  }

  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  query.first().then((device) => {
    if(device) {
      response.success(constructDeviceInfo(device))
    } else {
      response.success()
    }
  }).catch((error) => {
    console.log("fetchDeviceInfo error", error)
    response.error(error)
  })
}
//生成设备二维码
function generateDeviceQrcode(request, response) {
  var deviceNo = request.params.deviceNo

  mpQrcodeFuncs.createLimitQRCode(deviceNo).then((url) => {
    response.success({
      qrcodeUrl: url
    })
  }).catch((error) => {
    console.log("generateDeviceQrcode", error)
    response.error(error)
  })
}


function getDeviceStatus(request, response) {

}

function deviceFuncTest(request, response) {
}

var deviceFunc = {
  IDLE: IDLE,
  OCCUPIED: OCCUPIED,
  OFFLINE: OFFLINE,
  fetchDeviceInfo: fetchDeviceInfo,
  getDeviceStatus: getDeviceStatus,
  generateDeviceQrcode: generateDeviceQrcode,
  deviceFuncTest: deviceFuncTest,
}

module.exports = deviceFunc