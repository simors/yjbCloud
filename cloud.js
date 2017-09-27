var AV = require('leanengine')
var authFunc = require('./cloudFuncs/Auth')
var activityFunc = require('./cloudFuncs/Activity')
var deviceFunc = require('./cloudFuncs/Device')
var PingppFunc = require('./cloudFuncs/Pingpp')
var orderFunc = require('./cloudFuncs/Order')
var mpJsSdkFuncs = require('./mpFuncs/JSSDK')
var stationFunc = require('./cloudFuncs/Station')
var baiduFunc = require('./cloudFuncs/Baidu')

/**
 * 云函数
 */
//用户
AV.Cloud.define('authFuncTest', authFunc.authFuncTest)
AV.Cloud.define('authFetchUserInfo', authFunc.fetchUserInfo)
AV.Cloud.define('authFetchWalletInfo', authFunc.fetchWalletInfo)
AV.Cloud.define('authFetchDealRecords', authFunc.fetchDealRecords)
AV.Cloud.define('authVerifyIdName', authFunc.verifyIdName)

//设备
AV.Cloud.define('deviceFetchDeviceInfo', deviceFunc.fetchDeviceInfo)
AV.Cloud.define('deviceGenerateDeviceQrcode', deviceFunc.generateDeviceQrcode)
AV.Cloud.define('deviceFuncTest', deviceFunc.deviceFuncTest)
AV.Cloud.define('deviceFetchDevices', deviceFunc.fetchDevices)
AV.Cloud.define('deviceChangeDeviceStatus', deviceFunc.changeDeviceStatus)
AV.Cloud.define('deviceRegisterDevice', deviceFunc.registerDevice)
AV.Cloud.define('deviceAssociateWithStation', deviceFunc.associateWithStation)
AV.Cloud.define('deviceUpdateDevice', deviceFunc.updateDevice)

//服务网点
AV.Cloud.define('stationCreateStation', stationFunc.createStation)
AV.Cloud.define('stationFetchStations', stationFunc.fetchStations)
AV.Cloud.define('stationUpdateStation', stationFunc.updateStation)
AV.Cloud.define('stationOpenStation', stationFunc.openStation)
AV.Cloud.define('stationCloseStation', stationFunc.closeStation)
AV.Cloud.define('stationFetchProfitSharing', stationFunc.fetchPartnerByStationId)
AV.Cloud.define('stationFetchInvestor', stationFunc.fetchInvestorByStationId)
AV.Cloud.define('stationCreateInvestor', stationFunc.createInvestor)
AV.Cloud.define('stationUpdateInvestor', stationFunc.updateInvestor)
AV.Cloud.define('stationCloseInvestor', stationFunc.closeInvestor)
AV.Cloud.define('stationOpenInvestor', stationFunc.openInvestor)
AV.Cloud.define('stationFuncTest', stationFunc.stationFuncTest)
AV.Cloud.define('stationCreatePartner', stationFunc.createPartner)
AV.Cloud.define('stationUpdatePartner', stationFunc.updatePartner)
AV.Cloud.define('stationOpenPartner', stationFunc.openPartner)
AV.Cloud.define('stationClosePartner', stationFunc.closePartner)
AV.Cloud.define('userFuncTest', stationFunc.userFuncTest)

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
AV.Cloud.define('orderFetchOrders', orderFunc.fetchOrders)

//微信
AV.Cloud.define('getJsConfig', mpJsSdkFuncs.getJsConfig)

//百度地图
AV.Cloud.define('baiduGetSubAreaList', baiduFunc.getSubAreaList)
AV.Cloud.define('baiduGetSubAreaList2', baiduFunc.getSubAreaList2)
AV.Cloud.define('baiduGetProviceList', baiduFunc.getProviceList)
AV.Cloud.define('baiduGetCityList', baiduFunc.getCityList)
AV.Cloud.define('baiduGetDistrictList', baiduFunc.getDistrictList)
AV.Cloud.define('baiduGetAllCityMap', baiduFunc.getAllCityMap)


module.exports = AV.Cloud;
