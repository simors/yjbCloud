/**
 * Created by wanpeng on 2017/8/18.
 */
var AV = require('leanengine')
var Promise = require('bluebird');
var GLOBAL_CONFIG = require('../config')
var client = require('mqtt').connect(GLOBAL_CONFIG.MQTT_SERVER_URL)
var websocketIO = require('../websocketIO')
var deviceFunc = require('../cloudFuncs/Device')
var orderFunc = require('../cloudFuncs/Order')
var mpMsgFunc = require('../mpFuncs/Message')

const namespace = websocketIO.of('/')

client.on('connect', connectEvent)
client.on('message', messageEvent)

function connectEvent(connack) {
  console.log("mqtt server connected")

  client.subscribe('online')
  client.subscribe('offline')
}

function messageEvent(topic, message, packet) {
  var topicLevel1 = topic.split('/')[0]

  switch (topicLevel1) {
    case 'online':
      handleDeviceOnline(message)
      break
    case 'offline':
      handleDeviceOffline(message)
      break
    // case 'deviceStatus':
    //   handleDeviceStatus(message)
    //   break
    case 'turnOnSuccess':
      handleTurnOnSuccess(message)
      break
    case 'turnOnFailed':
      handleTurnOnFailed(message)
      break
    case 'turnOffSuccess':
      handleTurnOffSuccess(message)
      break
    case 'turnOffFailed':
      handleTurnOffFailed(message)
      break
    case 'finish':
      handleFinish(message)
      break
    default:
      console.log("未知消息 topic:", message.toString())
      break
  }
}

//设备注册
function handleDeviceOnline(message) {
  console.log("收到设备上线消息", message.toString())

  var Message = JSON.parse(message.toString())
  var deviceNo = Message.deviceNo
  var onlineTime = Message.time

  var query = new AV.Query('Device')
  console.log("handleDeviceOnline Device Object")
  query.equalTo('deviceNo', deviceNo)

  query.first().then((device) => {
    if(device) {
      device.set('status', deviceFunc.IDLE)
      device.set('updateTime', new Date(onlineTime))

      return device.save()
    } else {
      var Device = AV.Object.extend('Device')
      var device = new Device()
      device.set('deviceNo', deviceNo)
      device.set('onlineTime', new Date(onlineTime))
      device.set('updateTime', new Date(onlineTime))
      device.set('deviceAddr', "")
      device.set('unitPrice', 0.1)    //设备计费单价：元／分钟
      device.set('status', deviceFunc.IDLE)

      return device.save()
    }
  }).then((device) => {
    var topics = []
    // topics.push('deviceStatus/' + deviceNo)   //设备状态上报消息
    topics.push('turnOnSuccess/' + deviceNo)  //开机成功消息
    topics.push('turnOnFailed/' + deviceNo)   //开机失败消息
    topics.push('turnOffSuccess/' + deviceNo)
    topics.push('turnOffFailed/' + deviceNo)
    topics.push('finish/' + deviceNo)         //干衣结束消息

    client.subscribe(topics, function (error) {
      if(error) {
        console.log("subscribe error", error)
      } else {
        console.log("subscribe success, topics:", topics)
      }
    })
  }).catch((error) => {
    if(error.code === 101) {  //第一台设备注册时，Device表尚未创建
      var Device = AV.Object.extend('Device')
      var device = new Device()
      device.set('deviceNo', deviceNo)
      device.set('onlineTime', new Date(onlineTime))
      device.set('updateTime', new Date(onlineTime))
      device.set('deviceAddr', "")
      device.set('unitPrice', 0.1)    //设备计费单价：元／分钟
      device.set('status', deviceFunc.IDLE)

      device.save().then(() => {
        var topics = []
        // topics.push('deviceStatus/' + deviceNo)   //设备状态上报消息
        topics.push('turnOnSuccess/' + deviceNo)  //开机成功消息
        topics.push('turnOnFailed/' + deviceNo)   //开机失败消息
        topics.push('turnOffSuccess/' + deviceNo)
        topics.push('turnOffFailed/' + deviceNo)
        topics.push('finish/' + deviceNo)         //干衣结束消息

        client.subscribe(topics, function (error) {
          if(error) {
            console.log("subscribe error", error)
          } else {
            console.log("subscribe success, topics:", topics)
          }
        })
      })
      return
    }
    console.error("设备注册失败", error)
  })
}

//设备下线
function handleDeviceOffline(message) {
  console.log("收到设备下线消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceNo = Message.deviceNo
  var offlineTime = Message.time
  var offlineMessage = Message.message

  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  query.first().then((device) => {
    if(device) {
      device.set('status', deviceFunc.OFFLINE)
      device.set('updateTime', new Date(offlineTime))
      return device.save()
    } else {
      return
    }
  }).then((leanDevice) => {
    if(leanDevice) {
      client.unsubscribe('deviceStatus/' + deviceNo)
    }
  }).catch(() => {
    console.error("设备下线失败", error)
  })
}

//设备状态更新
function handleDeviceStatus(message) {
  // console.log("收到设备状态更新消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceNo = Message.deviceNo
  var updateTime = Message.time
  var status = Message.status

  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  query.first().then((device) => {
    if(device) {
      device.set('status', status)
      device.set('updateTime', new Date(updateTime))
      device.save()
    }
  }).catch((error) => {
    console.error("设备注册状态更新失败", error)
  })
}

//开启设备
function turnOnDevice(deviceNo, userId, socketId) {
  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  return query.first().then((device) => {
    var currentStatus = device && device.attributes.status
    if(device && (currentStatus === deviceFunc.IDLE)) {
      var turnOnMessage = {
        socketId: socketId,
        deviceNo: deviceNo,
        userId: userId,
        time: Date.now()
      }

      return new Promise((resolve, reject) => {
        client.publish('turnOn/' + deviceNo, JSON.stringify(turnOnMessage), function (error) {
          if(error) {
            console.log("publish turnOn error:", error)
            resolve({
              errorCode: 1,
              errorMessage: "设备请求失败"
            })
          } else {
            console.log("publish success, topic:", 'turnOn/' + deviceNo)
            resolve({
              errorCode: 0,
              errorMessage: ""
            })
          }
        })
      })
    } else {
      return {
        errorCode: 2,
        errorMessage: "没有该设备或设备状态有误"
      }
    }
  }).catch((error) => {
    throw error
  })
}

//设备开启成功
function handleTurnOnSuccess(message) {
  var TURN_ON_DEVICE_SUCCESS = require('../websocket/').TURN_ON_DEVICE_SUCCESS
  var TURN_ON_DEVICE_FAILED = require('../websocket').TURN_ON_DEVICE_FAILED
  console.log("收到设备开启成功消息", message.toString())
  handleDeviceStatus(message)
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceNo = Message.deviceNo
  var userId = Message.userId
  var turnOnTime = Message.time
  var status = Message.status

  namespace.clients((error, client) => {
    if(client.indexOf(socketId) === -1) {
      //doNothing 多节点情况下
    } else {
      //TODO 创建订单
      orderFunc.createOrder(deviceNo, userId, turnOnTime).then((orderInfo) => {

        //websocket 发送开启成功消息
        namespace.to(socketId).emit(TURN_ON_DEVICE_SUCCESS, orderInfo)
        //TODO 微信模版消息

      }).catch((error) => {
        console.log("handleTurnOnSuccess", error)
        //websocket 发送开启失败消息
        namespace.to(socketId).emit(TURN_ON_DEVICE_FAILED, {deviceNo: deviceNo})
      })
    }
  })

}

//设备开启失败
function handleTurnOnFailed(message) {
  console.log("收到设备开启失败消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceNo = Message.deviceNo
  var updateTime = Message.time
  var status = Message.status

  //TODO 通知客户端
  //TODO 微信模版消息
}

//设备关机
function turnOffDevice(deviceNo, userId, socketId, orderId) {
  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  return query.first().then((device) => {
    var currentStatus = device && device.attributes.status
    console.log("turnOffDevice currentStatus", currentStatus)
    if(device && (currentStatus === deviceFunc.OCCUPIED)) {
      var turnOffMessage = {
        socketId: socketId,
        deviceNo: deviceNo,
        userId: userId,
        orderId: orderId,
        time: Date.now()
      }

      return new Promise((resolve, reject) => {
        client.publish('turnOff/' + deviceNo, JSON.stringify(turnOffMessage), function (error) {
          if(error) {
            console.log("publish turnOff error:", error)
            resolve({
              errorCode: 1,
              errorMessage: "设备请求失败"
            })
            return
          }
          console.log("publish success, topic:", 'turnOff/' + deviceNo)
          resolve({
            errorCode: 0,
            errorMessage: ""
          })
        })
      })
    } else {
      return {
        errorCode: 2,
        errorMessage: "没有该设备或设备状态有误"
      }
    }
  }).catch((error) => {
    throw error
  })
}

function handleTurnOffSuccess(message) {
  var TURN_OFF_DEVICE_SUCCESS = require('../websocket/').TURN_OFF_DEVICE_SUCCESS
  var TURN_OFF_DEVICE_FAILED = require('../websocket').TURN_OFF_DEVICE_FAILED
  console.log("收到设备关机成功消息", message.toString())
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceNo = Message.deviceNo
  var userId = Message.userId
  var orderId = Message.orderId
  var turnOffTime = Message.time
  var status = Message.status

  namespace.clients((error, client) => {
    if(client.indexOf(socketId) === -1) {
      //doNothing 多节点情况下
      return
    }
    orderFunc.finishOrder(deviceNo, userId, turnOffTime).then((orderInfo) => {
      //websocket 发送关机成功消息
      namespace.to(socketId).emit(TURN_OFF_DEVICE_SUCCESS, orderInfo)
    }).catch((error) => {
      console.log("finishOrder", error)
      namespace.to(socketId).emit(TURN_OFF_DEVICE_FAILED, {deviceNo: deviceNo})
    })
  })
}

function handleTurnOffFailed(message) {
  var TURN_OFF_DEVICE_FAILED = require('../websocket').TURN_OFF_DEVICE_FAILED
  console.log("收到设备关机失败消息", message.toString())
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceNo = Message.deviceNo

  namespace.clients((error, client) => {
    if(client.indexOf(socketId) === -1) {
      //doNothing 多节点情况下
      return
    }
    namespace.to(socketId).emit(TURN_OFF_DEVICE_FAILED, {deviceNo: deviceNo})
  })
}


//设备干衣结束
function handleFinish(message) {
  console.log("收到设备干衣结束消息", message.toString())
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceNo = Message.deviceNo
  var userId = Message.userId
  var finishTime = Message.time
  var status = Message.status

  orderFunc.finishOrder(deviceNo, userId, finishTime).then((orderInfo) => {
    if(!orderInfo) {
      //结束订单失败
      return
    }
    var user = AV.Object.createWithoutData('_User', userId)
    user.fetch().then((leanUser) => {
      var openid = leanUser.attributes.authData.weixin.openid
      return mpMsgFunc.sendFinishTmpMsg(openid, orderInfo.id, orderInfo.orderNo, orderInfo.amount, orderInfo.deviceAddr)
    }).catch((error) => {
      throw error
    })
  }).catch((error) => {
    console.log("handleFinish", error)
  })
}

var mqttFunc = {
  turnOnDevice: turnOnDevice,
  turnOffDevice: turnOffDevice,
}

module.exports = mqttFunc