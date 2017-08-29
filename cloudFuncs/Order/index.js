/**
 * Created by wanpeng on 2017/8/29.
 */
var AV = require('leanengine');
const uuidv4 = require('uuid/v4')

//设备状态 occupied
const ORDER_STATUS_UNPAID = 0  //未支付
const ORDER_STATUS_OCCUPIED = 1 //使用中
const ORDER_STATUS_PAID = 2 //已支付

function constructOrderInfo(order) {
  var orderInfo = {}
  orderInfo.id = order.id
  orderInfo.orderNo = order.attributes.order_no
  orderInfo.createTime = order.attributes.start.valueOf()
  orderInfo.status = order.attributes.status

  var user = order.attributes.user
  var device = order.attributes.device
  return user.fetch().then((leanUser) => {
    orderInfo.userId = leanUser.id
    return device.fetch()
  }).then((leanDevice) => {
    orderInfo.deviceNo = leanDevice.attributes.deviceNo
    orderInfo.deviceAddr = leanDevice.attributes.deviceAddr

    return orderInfo
  }).catch((error) => {
    console.log('constructOrderInfo', error)
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
      order.set('start', Date(turnOnTime))
      order.set('status', ORDER_STATUS_OCCUPIED)

      return order.save()
    } else {
      throw new Error('无效的设备')
    }
  }).then((order) => {
    return constructOrderInfo(order)
  }).catch((error) => {
    console.log('createOrder', error)
    throw error
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
}

module.exports = orderFunc