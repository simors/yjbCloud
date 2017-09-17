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

  //订阅所有设备的消息
  deviceFunc.getDeviceNoList().then((deviceNoList) => {
    deviceNoList.forEach((deviceNo) => {
      var topics = []
      topics.push('turnOnSuccess/' + deviceNo)  //开机成功消息
      topics.push('turnOnFailed/' + deviceNo)
      topics.push('turnOffSuccess/' + deviceNo)
      topics.push('turnOffFailed/' + deviceNo)
      topics.push('breakdown/' + deviceNo)
      topics.push('finish/' + deviceNo)         //干衣结束消息

      client.subscribe(topics, function (error) {
        if(error) {
          console.error("mqtt subscribe error", error)
        }
      })
    })
  }).catch((error) => {
    console.error(error)
  })
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
    case 'breakdown':
      handleBreakdown(message)
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

  deviceFunc.createDevice(deviceNo, new Date(onlineTime)).then((device) => {
    var topics = []
    topics.push('turnOnSuccess/' + deviceNo)  //开机成功消息
    topics.push('turnOnFailed/' + deviceNo)
    topics.push('turnOffSuccess/' + deviceNo)
    topics.push('turnOffFailed/' + deviceNo)
    topics.push('breakdown/' + deviceNo)
    topics.push('finish/' + deviceNo)         //干衣结束消息

    client.subscribe(topics, function (error) {
      if(error) {
        console.log("subscribe error", error)
        return
      }
      console.log("subscribe success, topics:", topics)
    })
  }).catch((error) => {
    console.error("设备注册失败", error)
    //TODO 通知相关人员
  })
}

//设备下线
function handleDeviceOffline(message) {
  console.log("收到设备下线消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceNo = Message.deviceNo
  var offlineTime = Message.time
  var offlineMessage = Message.message

  deviceFunc.updateDeviceStatus(deviceNo, deviceFunc.DEVICE_STATUS_OFFLINE, new Date(offlineTime)).then((device) => {
    if(device) {
      //TODO 区分正常下线和异常下线
      var topics = []
      topics.push('turnOnSuccess/' + deviceNo)  //开机成功消息
      topics.push('turnOnFailed/' + deviceNo)
      topics.push('turnOffSuccess/' + deviceNo)
      topics.push('turnOffFailed/' + deviceNo)
      topics.push('finish/' + deviceNo)         //干衣结束消息

      client.unsubscribe(topics)
    }
  }).catch((error) => {
    console.error("设备下线失败", error)
  })
}

//开启设备
function turnOnDevice(deviceNo, userId, socketId) {

  return deviceFunc.getDeviceStatus(deviceNo).then((status) => {
    if(status === deviceFunc.DEVICE_STATUS_IDLE) {
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
    }
    return {
      errorCode: 2,
      errorMessage: "没有该设备或设备状态有误"
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
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceNo = Message.deviceNo
  var userId = Message.userId
  var turnOnTime = Message.time
  var status = Message.status
  var orderInfo = undefined

  namespace.clients((error, client) => {
    if(client.indexOf(socketId) === -1) {
      //doNothing 多节点情况下
    } else {
      orderFunc.createOrder(deviceNo, userId, turnOnTime).then((result) => {
        orderInfo = result
        return deviceFunc.updateDeviceStatus(deviceNo, deviceFunc.DEVICE_STATUS_OCCUPIED, new Date(turnOnTime))
      }).then(() => {
        //websocket 发送开启成功消息
        namespace.to(socketId).emit(TURN_ON_DEVICE_SUCCESS, orderInfo)
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

  return deviceFunc.getDeviceStatus(deviceNo).then((status) => {
    if(status === deviceFunc.DEVICE_STATUS_OCCUPIED) {
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
    }
    return {
      errorCode: 2,
      errorMessage: "没有该设备或设备状态有误"
    }
  }).catch((error) => {
    throw error
  })
}

function socketIdVerify(namespace, socketId) {
  return new Promise(function (resolve, reject) {
    namespace.clients((error, client) => {
      if(client.indexOf(socketId) === -1) {
        //doNothing 多节点情况下
        resolve(false)
      }
      resolve(true)
    })
  })
}

async function handleTurnOffSuccess(message) {
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

  try {
    let socketIdValid = await socketIdVerify(namespace, socketId)
    if(!socketIdValid) {
      return
    }
    let orderInfo = await orderFunc.finishOrder(deviceNo, turnOffTime)
    if(orderInfo) {
      deviceFunc.updateDeviceStatus(deviceNo, deviceFunc.DEVICE_STATUS_IDLE, new Date(turnOffTime))
      namespace.to(socketId).emit(TURN_OFF_DEVICE_SUCCESS, orderInfo)
    }
  } catch (error) {
    console.log("finishOrder", error)
    namespace.to(socketId).emit(TURN_OFF_DEVICE_FAILED, {deviceNo: deviceNo})
  }
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
async function handleFinish(message) {
  console.log("收到设备干衣结束消息", message.toString())
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceNo = Message.deviceNo
  var userId = Message.userId
  var finishTime = Message.time
  var status = Message.status

  try {
    let orderInfo = await orderFunc.finishOrder(deviceNo, finishTime)
    if(!orderInfo) {
      console.log("结束订单失败")
      return
    }
    deviceFunc.updateDeviceStatus(deviceNo, deviceFunc.DEVICE_STATUS_IDLE, new Date(finishTime))
    let user = AV.Object.createWithoutData('_User', userId)

    let leanUser = await user.fetch()
    let openid = leanUser.attributes.authData.weixin.openid
    mpMsgFunc.sendFinishTmpMsg(openid, orderInfo.id, orderInfo.orderNo, orderInfo.amount, orderInfo.deviceAddr)
  } catch (error) {
    console.log("handleFinish", error)
  }
}

//设备故障
async function handleBreakdown(message) {
  console.log("收到设备故障消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceNo = Message.deviceNo
  var errCode = Message.errCode
  var breakdownTime = Message.time

  try {
    let status = await deviceFunc.getDeviceStatus(deviceNo)
    if(status != deviceFunc.DEVICE_STATUS_OCCUPIED) {
      return
    }
    let orderInfo = await orderFunc.finishOrder(deviceNo, breakdownTime)
    if(!orderInfo) {
      return
    }
    deviceFunc.updateDeviceStatus(deviceNo, deviceFunc.DEVICE_STATUS_FAULT, new Date(breakdownTime))
    //TODO 向正在使用的用户发送设备故障消息

    //TODO 短信通知网点管理员
    AV.Cloud.requestSmsCode({
      mobilePhoneNumber: '',
      template: '衣家宝设备故障通知',
      stationName: '',
      admin: '',
      deviceNo: deviceNo,
      errCode: errCode,
    })
  } catch (error) {
    console.log("handleBreakdown", error)
  }
}

var mqttFunc = {
  turnOnDevice: turnOnDevice,
  turnOffDevice: turnOffDevice,
}

module.exports = mqttFunc