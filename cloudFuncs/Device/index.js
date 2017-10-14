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

function constructDeviceInfo(device, includeStation) {
  var constructStationInfo = require('../Station').constructStationInfo
  var deviceInfo = {}
  deviceInfo.id = device.id
  deviceInfo.deviceNo = device.attributes.deviceNo
  deviceInfo.status = device.attributes.status
  deviceInfo.deviceAddr = device.attributes.deviceAddr
  deviceInfo.onlineTime = device.attributes.onlineTime
  deviceInfo.updateTime = device.attributes.updateTime
  deviceInfo.standbyPower = device.attributes.standbyPower
  deviceInfo.usePower = device.attributes.usePower

  let station = device.attributes.station
  deviceInfo.stationId = station? station.id : undefined
  if(includeStation && station) {
    deviceInfo.station = constructStationInfo(station, false)
  }
  return deviceInfo
}

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
  query.include('station')
  query.first().then((device) => {
    if(!device) {
      response.error(new Error("没有找到设备信息"))
      return
    }
    response.success(constructDeviceInfo(device, true))
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
  query.include('station')
  if(deviceNo) {
    query.equalTo('deviceNo', deviceNo)
  }
  if(stationId) {
    var station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if(status != undefined) {
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
      deviceList.push(constructDeviceInfo(leanDevice, true))
    })
    response.success(deviceList)
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
      device.set('standbyPower', 1)
      device.set('usePower', 10)
      device.set('status', DEVICE_STATUS_UNREGISTER)

      //TODO 通知管理平台新设备上线
      return device.save()
    }
  }).catch((error) => {
    console.log("createDevice", error)
    throw error
  })
}

/**
 * 关联设备和服务网点
 * @param {Object}  request
 * @param {Object}  response
 */
async function associateWithStation(request, response) {
  var currentUser = request.currentUser
  let stationId = request.params.stationId
  var deviceNo = request.params.deviceNo

  let station = AV.Object.createWithoutData('Station', stationId)
  var query = new AV.Query('Device')
  query.include('station')
  query.equalTo('deviceNo', deviceNo)
  query.first().then((device) => {
    device.set('station', station)
    device.set('status', DEVICE_STATUS_MAINTAIN)
    return device.save()
  }).then((device) => {
    return query.get(device.id)
  }).then((device) => {
    response.success(constructDeviceInfo(device, true))
  }).catch((error) => {
    console.log("associateWithStation", error)
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
    device.set('updateTime', updateTime)

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

/**
 * 获取设备编号列表
 */
async function getDeviceNoList() {
  var query = new AV.Query('Device')
  let deviceNoList = []
  let lastCreatedAt = undefined

  try {
    while (1) {
      if(lastCreatedAt) {
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let results = await query.find()
      if(results.length < 1) {
        break
      }
      results.forEach((device) => {
        deviceNoList.push(device.attributes.deviceNo)
      })
      lastCreatedAt = results[results.length - 1].createdAt.valueOf()
    }
    return deviceNoList
  } catch (error) {
    console.log("getDeviceNoList", error)
    throw error
  }
}

/**
 * 查询设备列表
 * @param {String}  stationId
 */
async function getDevices(stationId) {
  if(!stationId) {
    return undefined
  }
  let query = new AV.Query('Device')
  var station = AV.Object.createWithoutData('Station', stationId)
  query.equalTo('station', station)
  query.descending('createdAt')
  let lastCreatedAt = undefined
  let deviceList = []

  try {
    while(1) {
      if(lastCreatedAt) {
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let devices = await query.find()
      if(devices.length < 1) {
        break
      }
      devices.forEach((device) => {
        deviceList.push(constructDeviceInfo(device, false))
      })
      lastCreatedAt = devices[devices.length - 1].createdAt.valueOf()
    }
    return deviceList
  } catch (error) {
    console.log("getDevices", error)
    throw error
  }
}

/**
 * 更新设备信息
 * @param {Object}  request
 * @param {Object}  response
 */
function updateDevice(request, response) {
  var currentUser = request.currentUser
  let deviceNo = request.params.deviceNo
  let stationId = request.params.stationId
  let deviceAddr = request.params.deviceAddr
  let status = Number(request.params.status)

  let station = AV.Object.createWithoutData('Station', stationId)
  var query = new AV.Query('Device')
  query.include('station')
  query.equalTo('deviceNo', deviceNo)
  query.first().then((device) => {
    device.set('station', station)
    device.set('deviceAddr', deviceAddr)
    device.set('status', status)
    return device.save()
  }).then((device) => {
    return query.get(device.id)
  }).then((device) => {
    response.success(constructDeviceInfo(device, true))
  }).catch((error) => {
    console.log("updateDevice", error)
    response.success(error)
  })

}

function deviceFuncTest(request, response) {
  let stationId = request.params.stationId

  response.success(getDevices(stationId))
}

var deviceFunc = {
  constructDeviceInfo: constructDeviceInfo,
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
  getDeviceNoList: getDeviceNoList,
  associateWithStation: associateWithStation,
  updateDevice: updateDevice,
  getDevices: getDevices,
  deviceFuncTest: deviceFuncTest,
}

module.exports = deviceFunc