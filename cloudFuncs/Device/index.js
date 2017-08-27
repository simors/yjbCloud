/**
 * Created by wanpeng on 2017/8/22.
 */
var AV = require('leanengine');

//设备状态
const IDLE = 0  //空闲
const OCCUPIED = 1 //使用中
const OFFLINE = 2 //下线

function constructDeviceInfo(device) {
  var deviceInfo = {}
  deviceInfo.id = device.id
  deviceInfo.deviceId = device.attributes.deviceId
  deviceInfo.status = device.attributes.status
  deviceInfo.onlineTime = device.attributes.onlineTime.valueOf()
  deviceInfo.updateTime = device.attributes.updateTime.valueOf()

  return deviceInfo
}

function fetchDeviceInfo(request, response) {
  var deviceid = request.params.deviceid

  if(!deviceid) {
    response.error(new Error("无效到设备id"))
    return
  }

  var query = new AV.Query('Device')
  query.equalTo('deviceId', deviceid)

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


function getDeviceStatus(request, response) {

}

function deviceFuncTest(request, response) {
}

var deviceFunc = {
  fetchDeviceInfo: fetchDeviceInfo,
  getDeviceStatus: getDeviceStatus,
  deviceFuncTest: deviceFuncTest,
}

module.exports = deviceFunc