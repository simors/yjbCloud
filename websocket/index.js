/**
 * Created by wanpeng on 2017/8/27.
 */
var redis = require('redis');
var activityFunc = require('../cloudFuncs/Activity')
var turnOnDevice = require('../mqtt').turnOnDevice


//活动请求&应答
const ACTIVITY_REQUEST = 'activity_request'
const ACTIVITY_RESPONSE = 'activity_response'

//设备开机请求&应答
const TURN_ON_DEVICE = 'turn_on_device'
const TURN_ON_DEVICE_SUCCESS = 'turn_on_device_success'
const TURN_ON_DEVICE_FAILED = 'turn_on_device_failed'

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
    var deviceId = data.deviceId
    var userId = data.userId
    var socketId = socket.id
    var ackData = {
      deviceId: deviceId,
      errorCode: 0,
      errorMessage: ""
    }

    turnOnDevice(deviceId, userId, socketId).then((result) => {
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

}

var websocketFunc = {
  connectionEvent: connectionEvent,
}

module.exports = websocketFunc