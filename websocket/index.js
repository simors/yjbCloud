/**
 * Created by wanpeng on 2017/8/27.
 */
var Promise = require('bluebird')
var redis = require('redis')
var activityFunc = require('../cloudFuncs/Activity')
var turnOnDevice = require('../mqtt').turnOnDevice
var turnOffDevice = require('../mqtt').turnOffDevice

//websocket消息
const ACTIVITY_REQUEST = 'activity_request'     //活动请求&应答
const ACTIVITY_RESPONSE = 'activity_response'
const TURN_ON_DEVICE = 'turn_on_device'         //设备开机请求&应答
const TURN_ON_DEVICE_SUCCESS = 'turn_on_device_success'
const TURN_ON_DEVICE_FAILED = 'turn_on_device_failed'
const TURN_OFF_DEVICE = 'turn_off_device'       //设备关机请求&应答
const TURN_OFF_DEVICE_SUCCESS = 'turn_off_device_success'
const TURN_OFF_DEVICE_FAILED = 'turn_off_device_failed'

function connectionEvent(socket) {
  //接收到H5页面的活动请求
  socket.on(ACTIVITY_REQUEST, function (data) {
    console.log("收到活动请求：", data)
    var activityId = data.activityId
    var openid = data.openid

    activityFunc.checkActivityRequest(activityId, openid).then((activity) => {
      if(activity.pass) {
        activityFunc.insertActivityMessage(socket.id, openid, activityId, activity.activityCategory).then((result) => {
          console.log("活动请求消息入队成功")
        }).catch((error) => {
          console.log("活动请求消息入队失败", error)
          socket.to(socket.id).emit(ACTIVITY_RESPONSE, {result: 'fail'})
        })
      } else {
        socket.emit(ACTIVITY_RESPONSE, {result: activity.message})
      }
    })

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
  ACTIVITY_REQUEST: ACTIVITY_REQUEST,
  ACTIVITY_RESPONSE: ACTIVITY_RESPONSE,
  TURN_ON_DEVICE: TURN_ON_DEVICE,
  TURN_ON_DEVICE_SUCCESS: TURN_ON_DEVICE_SUCCESS,
  TURN_ON_DEVICE_FAILED: TURN_ON_DEVICE_FAILED,
  TURN_OFF_DEVICE: TURN_OFF_DEVICE,
  TURN_OFF_DEVICE_SUCCESS: TURN_OFF_DEVICE_SUCCESS,
  TURN_OFF_DEVICE_FAILED: TURN_OFF_DEVICE_FAILED,
  connectionEvent: connectionEvent,
}

module.exports = websocketFunc