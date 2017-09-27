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

function constructOrderInfo(order, includeDevice, includeUser) {
  let constructDeviceInfo = require('../Device').constructDeviceInfo
  let constructUserInfo = require('../Auth').constructUserInfo
  let orderInfo = {}
  orderInfo.id = order.id
  orderInfo.orderNo = order.attributes.order_no
  orderInfo.amount = order.attributes.amount
  if(order.attributes.start)
    orderInfo.createTime = order.attributes.start
  if(order.attributes.end)
    orderInfo.endTime = order.attributes.end
  orderInfo.status = order.attributes.status

  var user = order.attributes.user
  var device = order.attributes.device
  orderInfo.userId = user.id
  orderInfo.deviceNo = device.attributes.deviceNo
  orderInfo.deviceAddr = device.attributes.deviceAddr
  if(includeDevice) {
    orderInfo.device = constructDeviceInfo(device, true)
  }
  if(includeUser) {
    orderInfo.user = constructUserInfo(user)
  }
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
      orderList.push(constructOrderInfo(leanOrder, true, true))
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
    let query = new AV.Query('Order')
    query.include('device')
    query.include('user')
    return query.get(leanOrder.id)
  }).then((leanOrder) => {
    return constructOrderInfo(leanOrder, true, true)
  })
}

function  orderPayment(request, response) {
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

async function finishOrder(deviceNo, finishTime) {

  var deviceQuery = new AV.Query('Device')
  deviceQuery.equalTo('deviceNo', deviceNo)
  deviceQuery.include('station')
  var query = new AV.Query('Order')
  query.include('user')
  query.equalTo('status', ORDER_STATUS_OCCUPIED)

  let device = await deviceQuery.first()
  if(!device) {
    throw new Error("未找到设备")
  }
  let station = device.attributes.station
  let unitPrice = Number(station.attributes.unitPrice)
  query.equalTo('device', device)
  let queryResults = await query.find()
  if(queryResults.length != 1) {
    return undefined
  }
  let order = queryResults[0]
  let user = order.attributes.user
  let duration = mathjs.eval((finishTime - order.attributes.start.valueOf()) * 0.001 / 60)
  duration = duration < 1? 1: Number(duration.toFixed(0))
  let amount = mathjs.chain(unitPrice).multiply(duration).done()

  let mysqlConn = await mysqlUtil.getConnection()

  let deal = {
    to: 'platform',
    from: user.id,
    cost: amount,
    deal_type: PingppFunc.SERVICE,
  }

  let result = await PingppFunc.updateWalletInfo(mysqlConn, deal)
  order.set('status', ORDER_STATUS_UNPAID)
  order.set('end', new Date(finishTime))
  order.set('amount', amount)

  let leanOrder = await order.save()
  let orderInfo = await getOrderInfo(leanOrder.id)
  if(mysqlConn) {
    mysqlUtil.release(mysqlConn)
  }
  return orderInfo
}

/**
 * 分页查询订单
 * @param {Object}  request
 * @param {Object}  response
 */
async function fetchOrders(request, response) {
  let currentUser = request.currentUser
  let start = request.params.start
  let end = request.params.end
  let status = request.params.status
  let limit = request.params.limit || 10
  let isRefresh = request.params.isRefresh || true    //分页查询刷新
  let lastStartTime = request.params.lastStartTime  //分页查询历史查询最后一条记录的设备更新时间
  let mobilePhoneNumber = request.params.mobilePhoneNumber
  let stationId = request.params.stationId

  let query = new AV.Query('Order')
  query.include('user')
  query.include('device')
  query.include('device.station')
  query.limit(limit)

  if(status != undefined) {
    query.equalTo('status', status)
  }

  if(start) {
    query.greaterThanOrEqualTo('start', new Date(start))
  }

  if(end) {
    query.lessThan('start', new Date(end))
  }

  if(!isRefresh && lastStartTime) {
    query.lessThan('start', new Date(lastStartTime))
  }
  query.descending('updateAt')

  try {
    let results = await query.find()
    let orderList = []
    results.forEach((order) => {
      let device = order.attributes.device
      let user = order.attributes.user
      if(mobilePhoneNumber && (mobilePhoneNumber != user.attributes.mobilePhoneNumber)) {
        return
      }
      if(stationId && (stationId != device.attributes.station.id)) {
        return
      }
      orderList.push(constructOrderInfo(order, true, true))
    })
    response.success(orderList)
  } catch (error) {
    console.error(error)
    response.error(error)
  }
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
  constructOrderInfo: constructOrderInfo,
  orderFuncTest: orderFuncTest,
  createOrder: createOrder,
  fetchOrdersByStatus: fetchOrdersByStatus,
  updateOrderStatus: updateOrderStatus,
  orderPayment: orderPayment,
  finishOrder: finishOrder,
  fetchOrders: fetchOrders,
}

module.exports = orderFunc