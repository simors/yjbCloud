/**
 * Created by wanpeng on 2017/8/29.
 */
var AV = require('leanengine');
var mysqlUtil = require('../Util/mysqlUtil')
var PingppFunc = require('../Pingpp')
var mpMsgFuncs = require('../../mpFuncs/Message')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')
var mathjs = require('mathjs')

//设备状态
const ORDER_STATUS_UNPAID = 0  //未支付
const ORDER_STATUS_OCCUPIED = 1 //使用中
const ORDER_STATUS_PAID = 2 //已支付

function constructOrderInfo(order) {
  var orderInfo = {}
  orderInfo.id = order.id
  orderInfo.orderNo = order.attributes.order_no
  orderInfo.amount = order.attributes.amount
  if(order.attributes.start)
    orderInfo.createTime = order.attributes.start.valueOf()
  if(order.attributes.end)
    orderInfo.endTime = order.attributes.end.valueOf()
  orderInfo.status = order.attributes.status

  var user = order.attributes.user
  var device = order.attributes.device
  orderInfo.userId = user.id
  orderInfo.deviceNo = device.attributes.deviceNo
  orderInfo.deviceAddr = device.attributes.deviceAddr
  orderInfo.unitPrice = device.attributes.unitPrice

  return orderInfo
}

function getOrderInfo(orderId) {
  var orderInfo = {}
  var query = new AV.Query('Order')
  query.include('user')
  query.include('device')
  return query.get(orderId).then((order) => {
    orderInfo.id = order.id
    orderInfo.orderNo = order.attributes.order_no
    orderInfo.amount = order.attributes.amount
    if(order.attributes.start)
      orderInfo.createTime = order.attributes.start.valueOf()
    if(order.attributes.end)
      orderInfo.endTime = order.attributes.end.valueOf()
    orderInfo.status = order.attributes.status

    var user = order.attributes.user
    var device = order.attributes.device
    orderInfo.userId = user.id
    orderInfo.deviceNo = device.attributes.deviceNo
    orderInfo.deviceAddr = device.attributes.deviceAddr
    orderInfo.unitPrice = device.attributes.unitPrice

    return Promise.resolve(orderInfo)
  }).catch((error) => {
    console.log("getOrderInfo", error)
    throw error
  })
}

function createOrder(deviceNo, userId, turnOnTime) {
  var Order = AV.Object.extend('Order')
  var user = AV.Object.createWithoutData('_User', userId)

  var query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)

  return query.first().then((device) => {
    if(device) {
      var order = new Order()
      order.set('order_no', uuidv4().replace(/-/g, '').substr(0, 10))
      order.set('device', device)
      order.set('user',  user)
      order.set('start', new Date(turnOnTime))
      order.set('end', new Date(turnOnTime))
      order.set('status', ORDER_STATUS_OCCUPIED)
      order.set('amount', 0)

      return order.save()
    } else {
      throw new Error('无效的设备')
    }
  }).then((order) => {
    return getOrderInfo(order.id)
  }).catch((error) => {
    console.log('createOrder', error)
    throw error
  })
}

function fetchOrdersByStatus(request, response) {
  console.log("fetchOrdersByStatus params:", request.params)
  var userId = request.params.userId
  var orderStatus = request.params.orderStatus
  var limit = request.params.limit || 10
  var lastTurnOnTime = request.params.lastTurnOnTime
  var isRefresh = request.params.isRefresh

  var user = AV.Object.createWithoutData('_User', userId)
  var query = new AV.Query('Order')
  query.equalTo('user', user)
  query.equalTo('status', orderStatus)
  query.include('user')
  query.include('device')
  query.limit(limit)
  query.descending('start')
  if(!isRefresh && lastTurnOnTime) {
    query.lessThan('start', new Date(lastTurnOnTime))
  }

  query.find().then((results) => {
    var orderList = []
    results.forEach((leanOrder) => {
      orderList.push(constructOrderInfo(leanOrder))
    })
    response.success({orders: orderList})
  }).catch((error) => {
    console.log('fetchOrdersByStatus', error)
    response.error(error)
  })

}

function updateOrderStatus(orderId, status, endTime, amount) {
  var updateTime = Date.now()

  var order = AV.Object.createWithoutData('Order', orderId)

  order.set('status', status)
  order.set('end', new Date(endTime))
  order.set('amount', amount)
  if(status === ORDER_STATUS_PAID) {
    order.set('payTime', new Date(updateTime))
  }
  return order.save().then((leanOrder) => {
    return getOrderInfo(leanOrder.id)
  })
}

function  orderPayment(request, response) {
  console.log("orderPayment params:", request.params)
  var amount = Number(request.params.amount)
  var userId = request.params.userId
  var orderId = request.params.orderId
  var endTime = request.params.endTime

  var mysqlConn = undefined
  var orderInfo = undefined

  if(!userId || !orderId || !amount || !endTime) {
    response.error(new Error("参数错误"))
  }

  PingppFunc.getWalletInfo(userId).then((walletInfo) => {
    if(!walletInfo || amount > walletInfo.balance) {
      // return updateOrderStatus(orderId, ORDER_STATUS_UNPAID, endTime, amount).then((order) => {
      //   orderInfo = order
      //   response.success(orderInfo)
      // })
      response.success(new Error("余额不足"))
    } else {
      return updateOrderStatus(orderId, ORDER_STATUS_PAID, endTime, amount).then((order) => {
        orderInfo = order
        return mysqlUtil.getConnection()
      }).then((conn) => {
        mysqlConn = conn
        return mysqlUtil.beginTransaction(conn)
      }).then(() => {
        var deal = {
          to: 'platform',
          from: userId,
          cost: amount,
          deal_type: PingppFunc.SERVICE,
        }
        return PingppFunc.updateWalletInfo(mysqlConn, deal)
      }).then(() => {
        return mysqlUtil.commit(mysqlConn)
      }).then(() => {
        response.success(orderInfo)
        if(orderInfo.status === ORDER_STATUS_PAID) {
          return mpMsgFuncs.sendOrderPaymentTmpMsg(walletInfo.openid, amount, orderInfo.id, orderInfo.deviceAddr)
        }
      }).catch((error) => {
        throw error
      })
    }
  }).catch((error) => {
    console.log("orderPayment", error)
    if (mysqlConn) {
      console.log('transaction rollback')
      mysqlUtil.rollback(mysqlConn)
    }
    response.error(error)
  }).finally(() => {
    if(mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  })

}

function finishOrder(deviceNo, finishTime) {
  var unitPrice = undefined
  var mysqlConn = undefined

  var deviceQuery = new AV.Query('Device')
  deviceQuery.equalTo('deviceNo', deviceNo)
  var query = new AV.Query('Order')
  query.include('user')
  query.equalTo('status', ORDER_STATUS_OCCUPIED)

  return deviceQuery.first().then((device) => {
    unitPrice = Number(device.attributes.unitPrice)
    query.equalTo('device', device)
    return query.find()
  }).then((results) => {
    if(results.length === 1) {
      var order = results[0]
      var user = order.attributes.user
      var duration = mathjs.eval((finishTime - order.attributes.start.valueOf()) * 0.001 / 60)

      duration = duration < 1? 1: Number(duration.toFixed(0))
      var amount = mathjs.chain(unitPrice).multiply(duration).done()

      return mysqlUtil.getConnection().then((conn) => {
        mysqlConn = conn
        var deal = {
          to: 'platform',
          from: user.id,
          cost: amount,
          deal_type: PingppFunc.SERVICE,
        }
        return PingppFunc.updateWalletInfo(mysqlConn, deal)
      }).then(() => {
        order.set('status', ORDER_STATUS_UNPAID)
        order.set('end', new Date(finishTime))
        order.set('amount', amount)
        return order.save()
      }).then((leanOrder) => {
        return getOrderInfo(leanOrder.id)
      })
    }
    return Promise.reject(new Error("未找到订单信息"))
  }).catch((error) => {
    console.log("finishOrder", error)
    throw error
  }).finally(() => {
    if(mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  })
}

function orderFuncTest(request, response) {
  var deviceNo = request.params.deviceNo
  var userId = request.params.userId
  var turnOnTime = request.params.turnOnTime

  createOrder(deviceNo, userId, turnOnTime).then((orderInfo) => {
    response.success(orderInfo)
  }).catch((error) => {
    response.error(error)
  })
}


var orderFunc = {
  orderFuncTest: orderFuncTest,
  createOrder: createOrder,
  fetchOrdersByStatus: fetchOrdersByStatus,
  updateOrderStatus: updateOrderStatus,
  orderPayment: orderPayment,
  finishOrder: finishOrder,
}

module.exports = orderFunc