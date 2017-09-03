var AV = require('leanengine')
var authFunc = require('./cloudFuncs/Auth')
var activityFunc = require('./cloudFuncs/Activity')
var deviceFunc = require('./cloudFuncs/Device')
var PingppFunc = require('./cloudFuncs/Pingpp')
var orderFunc = require('./cloudFuncs/Order')

/**
 * 云函数
 */
//用户
AV.Cloud.define('authFuncTest', authFunc.authFuncTest)
AV.Cloud.define('authFetchUserInfo', authFunc.fetchUserInfo)
AV.Cloud.define('authFetchWalletInfo', authFunc.fetchWalletInfo)

//设备
AV.Cloud.define('deviceFetchDeviceInfo', deviceFunc.fetchDeviceInfo)
AV.Cloud.define('deviceGetDeviceStatus', deviceFunc.getDeviceStatus)
AV.Cloud.define('deviceFuncTest', deviceFunc.deviceFuncTest)


//营销活动
AV.Cloud.define('activityIncrActivityPageView', activityFunc.incrActivityPageView)
AV.Cloud.define('activityCreateActivity', activityFunc.createActivity)
AV.Cloud.define('activityDeleteActivity', activityFunc.deleteActivity)
AV.Cloud.define('activityGetActivitiesList', activityFunc.getActivitiesList)

//支付
AV.Cloud.define('pingppCreatePayment', PingppFunc.createPayment)
AV.Cloud.define('pingppPaymentEvent', PingppFunc.paymentEvent)
AV.Cloud.define('pingppCreateTransfer', PingppFunc.createTransfer)
AV.Cloud.define('pingppTransferEvent', PingppFunc.transferEvent)

//订单
AV.Cloud.define('orderFuncTest', orderFunc.orderFuncTest)
AV.Cloud.define('orderFetchOrdersByStatus', orderFunc.fetchOrdersByStatus)
AV.Cloud.define('orderOrderPayment', orderFunc.orderPayment)



module.exports = AV.Cloud;
