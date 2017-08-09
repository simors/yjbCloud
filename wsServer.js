/**
 * Created by wanpeng on 2017/8/7.
 */
var amqp = require('amqplib');
var redis = require('redis');
var GLOBAL_CONFIG = require('./config')
var io = require('socket.io')(8080)
var activityFunc = require('./cloudFuncs/Activity')

const namespace = io.of('/')

//活动请求&应答
const ACTIVITY_REQUEST = 'activity_request'
const ACTIVITY_RESPONSE = 'activity_response'


io.sockets.on('connection', function (socket) {
  //接收到H5页面的活动请求
  socket.on(ACTIVITY_REQUEST, function (data) {
    console.log("收到请求：", data)
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

})

amqp.connect(GLOBAL_CONFIG.RABBITMQ_URL).then(function(conn) {
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
      var body = msg.content.toString()
      var message = JSON.parse(body)

      console.log("queueMessage:", message)
      var socketId = message.socketId
      var openid = message.openid
      var activityId = message.activityId
      var activityCategory = message.activityCategory

      namespace.clients((error, clients) => {
        if(clients.indexOf(socketId) === -1) {
          //doNothing 多节点情况下
        } else {
          activityFunc.handleActivityMessage(activityId, activityCategory, openid).then((result) => {
            namespace.to(socketId).emit(ACTIVITY_RESPONSE, {result: result})
            ch.ack(msg)
          }).catch((error) => {
            console.log("处理活动请求失败", error)
          })
        }
      })
    }

  });
}).catch(console.warn)