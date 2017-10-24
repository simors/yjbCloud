/**
 * Created by wanpeng on 2017/8/27.
 */
var Promise = require('bluebird')
var amqp = require('amqplib')
var GLOBAL_CONFIG = require('../config')
var websocketIO = require('../websocketIO')
var activityFunc = require('../cloudFuncs/Activity')

var namespace = websocketIO.of('/')

amqp.connect(GLOBAL_CONFIG.RABBITMQ_URL).then(connectEvent).catch(console.warn)


function connectEvent(conn) {
  return conn.createChannel().then(function(ch) {
    //抽奖
    ch.assertExchange('lottery', 'fanout', {durable: false}).then(() => {
      return ch.assertQueue('', {exclusive: true})
    }).then((qok) => {
      return ch.bindQueue(qok.queue, 'lottery', '').then(function() {
        return qok.queue;
      });
    }).then((queue) => {
      return ch.consume(queue, handleQueueMessage, {noAck: false})
    }).then(() => {
      console.log(' [*] Waiting for lotteryMessage.')
    })

    //红包
    ch.assertExchange('redEnvelope', 'fanout', {durable: false}).then(() => {
      return ch.assertQueue('', {exclusive: true})
    }).then((qok) => {
      return ch.bindQueue(qok.queue, 'redEnvelope', '').then(function() {
        return qok.queue;
      });
    }).then((queue) => {
      return ch.consume(queue, handleQueueMessage, {noAck: false})
    }).then(() => {
      console.log(' [*] Waiting for redEnvelopeMessage.')
    })

    function handleQueueMessage(msg) {
      var PROMOTION_RESPONSE = require('../websocket').PROMOTION_RESPONSE
      var body = msg.content.toString()
      var message = JSON.parse(body)

      console.log("queueMessage:", message)
      var socketId = message.socketId
      var openid = message.openid
      var activityId = message.activityId
      var activityCategory = message.activityCategory

      namespace.clients((error, client) => {
        if(client.indexOf(socketId) === -1) {
          //doNothing 多节点情况下
        } else {
          activityFunc.handleActivityMessage(activityId, activityCategory, openid).then((result) => {
            namespace.to(socketId).emit(PROMOTION_RESPONSE, {result: result})
            ch.ack(msg)
          }).catch((error) => {
            console.log("处理活动请求失败", error)
          })
        }
      })
    }
  })
}
