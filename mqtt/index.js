/**
 * Created by wanpeng on 2017/8/18.
 */
var AV = require('leanengine')
var Promise = require('bluebird');
var GLOBAL_CONFIG = require('../config')
var client = require('mqtt').connect(GLOBAL_CONFIG.MQTT_SERVER_URL)
var websocketIO = require('../websocketIO')

const namespace = websocketIO.of('/')

//设备开机请求&应答
const TURN_ON_DEVICE = 'turn_on_device'
const TURN_ON_DEVICE_SUCCESS = 'turn_on_device_success'
const TURN_ON_DEVICE_FAILED = 'turn_on_device_failed'

//设备状态
const IDLE = 0  //空闲
const OCCUPIED = 1 //使用中
const OFFLINE = 2 //下线


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
    case 'deviceStatus':
      handleDeviceStatus(message)
      break
    case 'turnOnSuccess':
      handleTurnOnSuccess(message)
      break
    case 'turnOnFailed':
      handleTurnOnFailed(message)
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
  var deviceId = Message.deviceId
  var onlineTime = Message.time

  var query = new AV.Query('Device')
  query.equalTo('deviceId', deviceId)

  query.first().then((device) => {
    if(device) {
      device.set('status', IDLE)
      device.set('updateTime', new Date(onlineTime))

      return device.save()
    } else {
      var Device = AV.Object.extend('Device')
      var device = new Device()
      device.set('deviceId', deviceId)
      device.set('onlineTime', new Date(onlineTime))
      device.set('updateTime', new Date(onlineTime))
      device.set('status', "")

      return device.save()
    }
  }).then((device) => {
    var topics = []
    topics.push('deviceStatus/' + deviceId)   //设备状态上报消息
    topics.push('turnOnSuccess/' + deviceId)  //开机成功消息
    topics.push('turnOnFailed/' + deviceId)   //开机失败消息

    client.subscribe(topics, function (error) {
      if(error) {
        console.log("subscribe error", error)
      } else {
        console.log("subscribe success, topics:", topics)
      }
    })
  }).catch((error) => {
    console.error("设备注册失败", error)
  })
}

//设备下线
function handleDeviceOffline(message) {
  console.log("收到设备下线消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceId = Message.deviceId
  var offlineTime = Message.time
  var offlineMessage = Message.message

  var query = new AV.Query('Device')
  query.equalTo('deviceId', deviceId)

  query.first().then((device) => {
    if(device) {
      device.set('status', OFFLINE)
      device.set('updateTime', new Date(offlineTime))
      return device.save()
    } else {
      return
    }
  }).then((leanDevice) => {
    if(leanDevice) {
      client.unsubscribe('deviceStatus/' + deviceId)
    }
  }).catch(() => {
    console.error("设备下线失败", error)
  })
}

//设备状态更新
function handleDeviceStatus(message) {
  // console.log("收到设备状态更新消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceId = Message.deviceId
  var updateTime = Message.time
  var status = Message.status

  var query = new AV.Query('Device')
  query.equalTo('deviceId', deviceId)

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
function turnOnDevice(deviceId, userId, socketId) {
  var query = new AV.Query('Device')
  query.equalTo('deviceId', deviceId)

  return query.first().then((device) => {
    var currentStatus = device && device.attributes.status


    console.log("turnOnDevice currentStatus", currentStatus)
    if(device && (currentStatus === IDLE)) {
      var turnOnMessage = {
        socketId: socketId,
        deviceId: deviceId,
        time: Date.now()
      }

      return new Promise((resolve, reject) => {
        client.publish('turnOn/' + deviceId, JSON.stringify(turnOnMessage), function (error) {
          if(error) {
            console.log("publish turnOn error:", error)
            resolve({
              errorCode: 1,
              errorMessage: "设备请求失败"
            })
          } else {
            console.log("publish success, topic:", 'turnOn/' + deviceId)
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
  console.log("收到设备开启成功消息", message.toString())
  handleDeviceStatus(message)
  var Message = JSON.parse(message.toString())
  var socketId = Message.socketId
  var deviceId = Message.deviceId
  var updateTime = Message.time
  var status = Message.status

  //TODO 通知微信客户端
  console.log("namespace", namespace)
  namespace.clients((error, client) => {
    if(client.indexOf(socketId) === -1) {
      //doNothing 多节点情况下
    } else {
      console.log("websocket 发送开启成功消息")
      namespace.to(socketId).emit(TURN_ON_DEVICE_SUCCESS, {deviceId: deviceId})
    }
  })


  //TODO 微信模版消息

}

//设备开启失败
function handleTurnOnFailed(message) {
  console.log("收到设备开启失败消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceId = Message.deviceId
  var updateTime = Message.time
  var status = Message.status

  //TODO 通知客户端
  //TODO 微信模版消息
}

var mqttFunc = {
  turnOnDevice: turnOnDevice,
}

module.exports = mqttFunc