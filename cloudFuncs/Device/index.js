/**
 * Created by wanpeng on 2017/8/22.
 */
var AV = require('leanengine');
var Promise = require('bluebird')
var mpQrcodeFuncs = require('../../mpFuncs/Qrcode')

//设备状态
const DEVICE_STATUS_IDLE = 0          //空闲
const DEVICE_STATUS_OCCUPIED = 1      //使用中
const DEVICE_STATUS_OFFLINE = 2       //下线
const DEVICE_STATUS_FAULT = 3         //故障
const DEVICE_STATUS_MAINTAIN = 4      //维修保养
const DEVICE_STATUS_UNREGISTER = 5    //未注册

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

function getDeviceInfo(deviceId) {
  var deviceInfo = {}
  var query = new AV.Query('Device')
  query.include('station')

  return query.get(deviceId).then((device) => {
    deviceInfo.id = device.id

    var station = device.attributes.station
    if(station) {
      deviceInfo.stationId = station.id
    }
    deviceInfo.deviceNo = device.attributes.deviceNo
    deviceInfo.status = device.attributes.status
    deviceInfo.unitPrice = device.attributes.unitPrice
    deviceInfo.deviceAddr = device.attributes.deviceAddr
    deviceInfo.onlineTime = device.attributes.onlineTime.valueOf()
    deviceInfo.updateTime = device.attributes.updateTime.valueOf()

    return deviceInfo
  }).catch((error) => {
    console.log("getDeviceInfo", error)
    throw error
  })
}

// /**
//  * 创建设备
//  * @param {String}  deviceNo 设备编号
//  */
// function getDeviceInfoByNo(deviceNo) {
//   var deviceInfo = {}
//   var query = new AV.Query('Device')
//   query.equalTo('deviceNo', deviceNo)
//   query.include('station')
//
//   return query.first().then((device) => {
//     var station = device.attributes.station
//     deviceInfo.id = device.id
//     deviceInfo.deviceNo = device.attributes.deviceNo
//     deviceInfo.status = device.attributes.status
//     deviceInfo.deviceAddr = device.attributes.deviceAddr
//     deviceInfo.stationName = station.attributes.name
//
//     return deviceInfo
//   }).catch((error) => {
//     console.log("getDeviceInfoByNo", error)
//     throw error
//   })
// }

/**
 * 获取设备信息
 * @param {Object}  request
 * @param {Object}  response
 */
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

/**
 * 生成设备二维码
 * @param {Object}  request
 * @param {Object}  response
 */
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

/**
 * 分页查询设备
 * @param {Object}  request
 * @param {Object}  response
 */
function fetchDevices(request, response) {
  var currentUser = request.currentUser
  var status = request.params.status                  //设备状态
  var deviceNo = request.params.deviceNo              //设备编号
  var stationId = request.params.stationId            //服务网点id
  var limit = request.params.limit || 10              //分页查询限制
  var isRefresh = request.params.isRefresh || true    //分页查询刷新
  var lastUpdateTime = request.params.lastUpdateTime  //分页查询历史查询最后一条记录的设备更新时间


  var query = new AV.Query('Device')
  if(deviceNo) {
    query.equalTo('deviceNo', deviceNo)
  }
  if(stationId) {
    var station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if(status) {
    query.equalTo('status', status)
  }
  query.limit(limit)
  if(!isRefresh && lastUpdateTime) {
    query.lessThan('updateTime', new Date(lastUpdateTime))
  }
  query.descending('updateTime')

  query.find().then((results) => {
    var deviceList = []
    results.forEach((leanDevice) => {
      deviceList.push(constructDeviceInfo(leanDevice))
    })
    response.success({devices: deviceList})
  }).catch((error) => {
    console.log('fetchDevices', error)
    response.error(error)
  })
}

/**
 * 创建设备
 * @param {String}  deviceNo 设备编号
 * @param {Date}    onlineTime 上线时间
 */
function createDevice(deviceNo, onlineTime) {
  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  return query.first().then((device) => {
    if(device) {
      device.set('status', DEVICE_STATUS_IDLE)
      device.set('updateTime', onlineTime)

      return device.save()
    } else {
      var Device = AV.Object.extend('Device')
      var device = new Device()
      device.set('deviceNo', deviceNo)
      device.set('onlineTime', onlineTime)
      device.set('updateTime', onlineTime)
      device.set('deviceAddr', "")
      device.set('unitPrice', 0.1)    //设备计费单价：元／分钟
      device.set('status', DEVICE_STATUS_UNREGISTER)

      //TODO 通知管理平台新设备上线
      return device.save()
    }
  }).catch((error) => {
    console.log("updateDeviceStatus", error)
    throw error
  })
}

/**
 * 设备注册，关联设备和服务点
 * @param {Object}  request
 * @param {Object}  response
 */
function registerDevice(request, response) {
  var currentUser = request.currentUser
  var deviceNo = request.params.deviceNo
  var deviceAddr = request.params.deviceAddr
  var unitPrice = request.params.unitPrice
  var stationId = request.params.stationId

  var query = new AV.Query('Device')
  var station = AV.Object.createWithoutData('Station', stationId)
  query.equalTo('deviceNo', deviceNo)

  query.first().then((device) => {
    device.set('status', DEVICE_STATUS_IDLE)
    device.set('updateTime', new Date())
    device.set('deviceAddr', deviceAddr)
    device.set('unitPrice', unitPrice)
    device.set('station', station)

    device.save().then((leanDevice) => {
      response.success(getDeviceInfo(leanDevice.id))
    })
  }).catch((error) => {
    console.log("registerDevice", error)
    response.success(error)
  })
}

/**
 * 批量修改设备状态
 * @param {Object}  request
 * @param {Object}  response
 */
function changeDeviceStatus(request, response) {
  var currentUser = request.currentUser
  var deviceNo = request.params.deviceNo
  var status = request.params.status
  var stationId = request.params.stationId

  var query = new AV.Query('Device')
  var station = AV.Object.createWithoutData('Station', stationId)
  query.equalTo('station', station)
  if(deviceNo) {
    query.equalTo('deviceNo', deviceNo)
  }

  query.find().then((results) => {
    results.forEach((device) => {
      device.set('status', status)
      device.set('updateTime', new Date())

      return device.save()
    })
    response.success()
  }).catch((error) => {
    console.log("changeDeviceStatus", error)
    response.error(error)
  })
}

/**
 * 更新设备状态
 * @param {String}  deviceNo 设备编号
 * @param {Number}  status 状态
 * @param {Date}    updateTime 更新时间
 */
function updateDeviceStatus(deviceNo, status, updateTime) {
  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  return query.first().then((device) => {
    device.set('status', status)
    device.set('updateTime', onlineTime)

    return device.save()
  }).catch((error) => {
    console.log("updateDeviceStatus", error)
    throw error
  })
}

/**
 * 获取设备状态
 * @param {String}  deviceNo 设备编号
 */
function getDeviceStatus(deviceNo) {
  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  return query.first().then((device) => {
    if(device) {
      var status = device.attributes.status
      return status
    }
    return undefined
  }).catch((error) => {
    console.log("updateDeviceStatus", error)
    throw error
  })
}

function deviceFuncTest(request, response) {

}

var deviceFunc = {
  DEVICE_STATUS_IDLE: DEVICE_STATUS_IDLE,
  DEVICE_STATUS_OCCUPIED: DEVICE_STATUS_OCCUPIED,
  DEVICE_STATUS_MAINTAIN: DEVICE_STATUS_MAINTAIN,
  DEVICE_STATUS_FAULT: DEVICE_STATUS_FAULT,
  DEVICE_STATUS_OFFLINE: DEVICE_STATUS_OFFLINE,
  DEVICE_STATUS_UNREGISTER: DEVICE_STATUS_UNREGISTER,
  fetchDeviceInfo: fetchDeviceInfo,
  getDeviceStatus: getDeviceStatus,
  generateDeviceQrcode: generateDeviceQrcode,
  fetchDevices: fetchDevices,
  createDevice: createDevice,
  updateDeviceStatus: updateDeviceStatus,
  changeDeviceStatus: changeDeviceStatus,
  deviceFuncTest: deviceFuncTest,
}

module.exports = deviceFunc