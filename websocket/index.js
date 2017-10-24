/**
 * Created by wanpeng on 2017/8/27.
 */
var Promise = require('bluebird')
var redis = require('redis')
var activityFunc = require('../cloudFuncs/Activity')
var turnOnDevice = require('../mqtt').turnOnDevice
var turnOffDevice = require('../mqtt').turnOffDevice
import promotionFunc from '../cloudFuncs/Promotion'

//websocket消息
const TURN_ON_DEVICE = 'turn_on_device'         //设备开机请求&应答
const TURN_ON_DEVICE_SUCCESS = 'turn_on_device_success'
const TURN_ON_DEVICE_FAILED = 'turn_on_device_failed'
const TURN_OFF_DEVICE = 'turn_off_device'       //设备关机请求&应答
const TURN_OFF_DEVICE_SUCCESS = 'turn_off_device_success'
const TURN_OFF_DEVICE_FAILED = 'turn_off_device_failed'
const PROMOTION_REQUEST = 'PROMOTION_REQUEST'               //营销活动请求
const PROMOTION_RESPONSE = 'PROMOTION_RESPONSE'             //营销活动请求

function connectionEvent(socket) {
  //接收到H5页面的活动请求
  socket.on(PROMOTION_REQUEST, async function (data) {
    console.log("收到活动请求：", data)
    let promotionId = data.promotionId
    let userId = data.userId

    try {
      await promotionFunc.checkPromotionRequest(promotionId, userId)
      await promotionFunc.insertPromotionMessage(socket.id, userId, promotionId)
      // socket.emit(PROMOTION_RESPONSE, {errorCode: 0})
    } catch (error) {
      console.error(error)
      socket.emit(PROMOTION_RESPONSE, {errorCode: error.code})
    }
  })

  //接收到微信客户端的设备开机请求
  socket.on(TURN_ON_DEVICE, (data, callback) => {
    console.log("收到设备开机请求：", data)
    var deviceNo = data.deviceNo
    var userId = data.userId
    var socketId = socket.id
    var ackData = {
      deviceNo: deviceNo,
      errorCode: 0,
      errorMessage: ""
    }

    turnOnDevice(deviceNo, userId, socketId).then((result) => {
      ackData.errorCode = result.errorCode
      ackData.errorMessage = result.errorMessage
      callback(ackData)
    }).catch((error) => {
      console.log("设备开机失败", error)
      ackData.errorCode = 3
      ackData.errorMessage = error
      callback(ackData)
    })
  })

  //接收到微信客户端的设备关机请求
  socket.on(TURN_OFF_DEVICE, (data, callback) => {
    console.log("收到设备关机请求：", data)
    var deviceNo = data.deviceNo
    var userId = data.userId
    var orderId = data.orderId
    var socketId = socket.id
    var ackData = {
      deviceNo: deviceNo,
      errorCode: 0,
      errorMessage: ""
    }

    turnOffDevice(deviceNo, userId, socketId, orderId).then((result) => {
      ackData.errorCode = result.errorCode
      ackData.errorMessage = result.errorMessage
      ackData.order = result.order || undefined
      callback(ackData)
    }).catch((error) => {
      console.log("设备关机失败", error)
      ackData.errorCode = 4
      ackData.errorMessage = error
      callback(ackData)
    })
  })
}

var websocketFunc = {
  PROMOTION_RESPONSE: PROMOTION_RESPONSE,
  TURN_ON_DEVICE: TURN_ON_DEVICE,
  TURN_ON_DEVICE_SUCCESS: TURN_ON_DEVICE_SUCCESS,
  TURN_ON_DEVICE_FAILED: TURN_ON_DEVICE_FAILED,
  TURN_OFF_DEVICE: TURN_OFF_DEVICE,
  TURN_OFF_DEVICE_SUCCESS: TURN_OFF_DEVICE_SUCCESS,
  TURN_OFF_DEVICE_FAILED: TURN_OFF_DEVICE_FAILED,
  connectionEvent: connectionEvent,
}

module.exports = websocketFunc