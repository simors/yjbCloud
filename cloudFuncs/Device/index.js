/**
 * Created by wanpeng on 2017/8/22.
 */
var AV = require('leanengine');
var Promise = require('bluebird')
var mpQrcodeFuncs = require('../../mpFuncs/Qrcode')
import * as errno from '../errno'
import PingppFunc from '../Pingpp'
import orderFunc from '../Order'
import stationFunc from '../Station'
import moment from 'moment'
import {PERMISSION_CODE} from '../../rolePermission'
import * as authFuncs from '../Auth'


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
  deviceInfo.createdAt = device.createdAt
  deviceInfo.updatedAt = device.updatedAt

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
async function fetchDevices(request) {
  const {currentUser, params} = request
  let deviceList = []

  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let permissionAll = await authFuncs.authValidPermissions(currentUser.id, [PERMISSION_CODE.DEVICE_FETCH_ALL_DEVICE])
  let permissionRelate = await authFuncs.authValidPermissions(currentUser.id, [PERMISSION_CODE.DEVICE_FETCH_RELATED_DEVICE])

  if(!permissionAll && !permissionRelate) {
    return deviceList
  }
  const {status, deviceNo, stationId, limit, isRefresh, lastUpdatedAt} = params

  let query = new AV.Query('Device')
  let queryRelate = new AV.Query('Device')

  if(permissionRelate && !permissionAll) {
    let stationQuery = new AV.Query('Station')
    stationQuery.equalTo('admin', currentUser)
    let stations = await stationQuery.find()
    queryRelate.containedIn('station', stations)
  }
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
  if(!isRefresh && lastUpdatedAt) {
    query.lessThan('updatedAt', new Date(lastUpdatedAt))
  }

  let finallyQuery = AV.Query.and(query, queryRelate)
  finallyQuery.include('station')
  finallyQuery.limit(limit || 10)
  finallyQuery.descending('updatedAt')

  let results = await finallyQuery.find()
  let total = await finallyQuery.count()

  results.forEach((device) => {
    deviceList.push(constructDeviceInfo(device, true))
  })

  return {total: total, deviceList: deviceList}
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
      let currentStatus = device.attributes.status
      if(currentStatus != DEVICE_STATUS_UNREGISTER) {
        device.set('status', DEVICE_STATUS_IDLE)
      }
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
    stationFunc.changeDeviceNum(stationId, 'add')
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
    let currentStatus = device.attributes.status
    if(currentStatus != DEVICE_STATUS_UNREGISTER) {
      device.set('status', status)
    }
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
async function updateDevice(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  const {deviceNo, stationId, deviceAddr, status} = params

  if(!stationId || !deviceNo || !deviceAddr || status === undefined) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let station = AV.Object.createWithoutData('Station', stationId)
  let query = new AV.Query('Device')
  query.include('station')
  query.equalTo('deviceNo', deviceNo)

  let device = await query.first()
  let currentStation = device.attributes.station
  if(!currentStation) {
    throw new AV.Cloud.Error('无服务点信息', {code: errno.ERROR_NO_STATION})
  }
  if(currentStation.id != stationId) {
    device.set('station', station)
  }
  device.set('deviceAddr', deviceAddr)
  device.set('status', status)

  await device.save()
  if(currentStation.id != stationId) {
    stationFunc.changeDeviceNum(currentStation.id, 'sub')
    stationFunc.changeDeviceNum(stationId, 'add')
  }
  let deviceInfo =  await query.get(device.id)
  return constructDeviceInfo(deviceInfo, true)
}

/**
 * 检测设备状态和用户是否可以使用设备
 * @param {String} deviceNo
 * @param {String} userId
 */
async function turnOnDeviceCheck(deviceNo, userId) {
  try {
    if(!deviceNo || !userId) {
      return errno.EINVAL
    }
    let status = await getDeviceStatus(deviceNo)
    if(status != DEVICE_STATUS_IDLE) {
      return errno.ERROR_INVALID_STATUS
    }

    let userWalletInfo = await PingppFunc.getWalletInfo(userId)
    if(!userWalletInfo) {
      return errno.ERROR_NO_WALLET
    }
    const {deposit, debt, process} = userWalletInfo
    if(deposit ===0 || process === PingppFunc.WALLET_PROCESS_TYPE.REFUND_PROCESS) {
      return errno.ERROR_NO_DEPOSIT
    }
    if(debt > 0) {
      return errno.ERROR_UNPAID_ORDER
    }
    let occupiedOrder = await orderFunc.getOccupiedOrder(userId)
    if(occupiedOrder) {
      return errno.ERROR_OCCUPIED_ORDER
    }
    return 0
  } catch (error) {
    throw error
  }
}

function deviceFuncTest(request, response) {
  let stationId = request.params.stationId

  response.success(getDevices(stationId))
}

/**
 * 统计已与服务点绑定的设备数量
 * @returns {*|Promise|Promise<T>}
 */
async function statDeviceCount() {
  let query = new AV.Query('Device')
  query.notEqualTo('status', DEVICE_STATUS_UNREGISTER)
  return await query.count()
}

/**
 * 统计某段时间内与服务点绑定的设备数量
 * @param startDate
 * @param endDate
 * @returns {*|Promise|Promise<T>}
 */
async function statDeviceCountByDate(startDate, endDate) {
  let beginQuery = new AV.Query('Device')
  beginQuery.greaterThanOrEqualTo('createdAt', new Date(startDate))

  let endQuery = new AV.Query('Device')
  endQuery.lessThanOrEqualTo('createdAt', new Date(endDate))

  let query = AV.Query.and(beginQuery, endQuery)
  query.notEqualTo('status', DEVICE_STATUS_UNREGISTER)
  return await query.count()
}

/**
 * 统计每日、每月、每年新增设备数
 * @param request
 * @returns {{deviceCount: (*|Promise|Promise.<T>), lastDayDeviceCount: (*|Promise|Promise.<T>), lastMonthDeviceCount: (*|Promise|Promise.<T>), lastYearDeviceCount: (*|Promise|Promise.<T>)}}
 */
async function statDevice(request) {
  let endDate = moment().format('YYYY-MM-DD')

  let startDate = moment().subtract(1, 'days').format('YYYY-MM-DD')
  let lastDayDeviceCount = await statDeviceCountByDate(startDate, endDate)

  startDate = moment().subtract(1, 'months').format('YYYY-MM-DD')
  let lastMonthDeviceCount = await statDeviceCountByDate(startDate, endDate)

  startDate = moment().subtract(1, 'years').format('YYYY-MM-DD')
  let lastYearDeviceCount = await statDeviceCountByDate(startDate, endDate)

  let deviceCount = await statDeviceCount()

  return {
    deviceCount,
    lastDayDeviceCount,
    lastMonthDeviceCount,
    lastYearDeviceCount,
  }
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
  turnOnDeviceCheck: turnOnDeviceCheck,
  deviceFuncTest: deviceFuncTest,
  statDevice,
}

module.exports = deviceFunc