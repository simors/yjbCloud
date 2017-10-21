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
import * as errno from '../errno'

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
  orderInfo.payTime = order.attributes.payTime
  var user = order.attributes.user
  var device = order.attributes.device
  orderInfo.userId = user? user.id : undefined
  orderInfo.deviceId = device? device.id : undefined
  if(includeDevice && device) {
    orderInfo.device = constructDeviceInfo(device, true)
  }
  if(includeUser && user) {
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

async function fetchOwnsOrders(request, response) {
  let currentUser = request.currentUser
  var limit = request.params.limit || 10
  var lastTurnOnTime = request.params.lastTurnOnTime
  var isRefresh = request.params.isRefresh

  var query = new AV.Query('Order')
  query.equalTo('user', currentUser)
  query.limit(limit)
  if(!isRefresh && lastTurnOnTime) {
    query.lessThan('start', new Date(lastTurnOnTime))
  }
  query.descending('start')
  query.include('device')
  query.include('device.station')

  try {
    let orders = await query.find()
    let ownsOrders = []
    orders.forEach((order) => {
      ownsOrders.push(constructOrderInfo(order, true, false))
    })
    response.success(ownsOrders)
  } catch (error) {
    console.error(error)
    response.error(error)
  }
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
    query.include('device.station')
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
          deal_type: PingppFunc.DEAL_TYPE_SERVICE,
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
    deal_type: PingppFunc.DEAL_TYPE_SERVICE,
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
async function fetchOrders(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  const {start, end, status, limit, isRefresh, mobilePhoneNumber, stationId, lastCreatedAt} = params

  let startQuery = new AV.Query('Order')
  let endQuery = new AV.Query('Order')
  let otherQuery = new AV.Query('Order')
  if(start) {
    startQuery.greaterThanOrEqualTo('createdAt', new Date(start))
  }
  if(end) {
    endQuery.lessThan('createdAt', new Date(end))
  }
  if(status != undefined) {
    otherQuery.equalTo('status', status)
  }
  if(!isRefresh && lastCreatedAt) {
    otherQuery.lessThan('createdAt', new Date(lastCreatedAt))
  }

  let query = AV.Query.and(startQuery, endQuery, otherQuery)
  query.include('user')
  query.include('device')
  query.include('device.station')
  query.limit(limit || 10)
  query.descending('createdAt')

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
  return orderList
}

/**
 * 获取订单信息（websocket）
 * @param {String}  orderId
 */
async function fetchOrderInfo(orderId) {
  var query = new AV.Query('Order')
  query.include('user')
  query.include('device')
  query.include('device.station')

  let order = await query.get(orderId)

  return constructOrderInfo(order, true, true)
}

/**
 * 查询订单列表
 * @param {String}  deviceId    //设备id
 * @param {Date}    start       //查询起始时间
 * @param {Date}    end         //查询结束时间
 */
async function getOrders(deviceId, start, end) {
  if(!deviceId) {
    return undefined
  }

  let startQuery = new AV.Query('Order')
  let endQuery = new AV.Query('Order')
  let deviceQuery = new AV.Query('Order')
  startQuery.greaterThanOrEqualTo('payTime', new Date(start))
  endQuery.lessThan('payTime', new Date(end))

  let device = AV.Object.createWithoutData('Device', deviceId)
  deviceQuery.equalTo('device', device)
  deviceQuery.equalTo('status', ORDER_STATUS_PAID)
  let query = AV.Query.and(deviceQuery, startQuery, endQuery)
  query.descending('payTime')

  let lastPayTime = undefined
  let orderList = []

  try {
    while (1) {
      if(lastPayTime) {
        query.lessThan('payTime', new Date(lastPayTime))
      }
      let orders = await query.find()
      if(orders.length < 1) {
        break
      }
      orders.forEach((order) => {
        orderList.push(constructOrderInfo(order, false, false))
      })
      lastPayTime = orders[orders.length - 1].attributes.payTime.valueOf()
    }
    return orderList
  } catch (error) {
    console.log("getOrders", error)
    throw error
  }
}

async function orderFuncTest(request) {
  const {currentUser, params} = request
  const {deviceId, start, end} = params

  let results = await getOrders(deviceId, start, end)
  return results
}


var orderFunc = {
  constructOrderInfo: constructOrderInfo,
  orderFuncTest: orderFuncTest,
  createOrder: createOrder,
  fetchOwnsOrders: fetchOwnsOrders,
  updateOrderStatus: updateOrderStatus,
  orderPayment: orderPayment,
  finishOrder: finishOrder,
  fetchOrders: fetchOrders,
  fetchOrderInfo: fetchOrderInfo,
  getOrders: getOrders,
}

module.exports = orderFunc