/**
 * Created by wanpeng on 2017/8/18.
 */
var AV = require('leanengine')
var mqtt = require('mqtt')
var GLOBAL_CONFIG = require('../config')

var client  = mqtt.connect(GLOBAL_CONFIG.MQTT_SERVER_URL)

//设备状态
const IDLE = 0  //空闲
const OCCUPIED = 1 //使用中

client.on('connect', function (connack) {
  console.log("mqtt server connected")

  client.subscribe('online')
})

client.on('message', function (topic, message, packet) {
  switch (topic) {
    case 'online':
      handleDeviceOnlineMessage(message)
      break
    case 'deviceStatus':
      handleDeviceStatus(message)
      break
    default:
      break
  }
})

//设备注册
function handleDeviceOnlineMessage(message) {
  console.log("收到设备上线消息", message.toString())

  var Message = JSON.parse(message.toString())
  var deviceId = Message.deviceId
  var onlineTime = Message.onlineTime

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
  }).then((leanDevice) => {
    client.subscribe('deviceStatus:' + deviceId)
  }).catch(() => {
    console.error("设备注册失败", error)
  })
}

//设备状态更新
function handleDeviceStatus(message) {
  console.log("收到设备状态更新消息", message.toString())
  var Message = JSON.parse(message.toString())
  var deviceId = Message.deviceId
  var updateTime = Message.updateTime
  var status = Message.status

  var query = new AV.Query('Device')
  query.equalTo('deviceId', deviceId)

  query.first().then((device) => {
    if(device) {
      device.set('status', status)

      device.save()
    }
  }).catch((error) => {
    console.error("设备注册状态更新", error)
  })
}