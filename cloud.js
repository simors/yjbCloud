var AV = require('leanengine')
var authFunc = require('./cloudFuncs/Auth')
var userFunc = require('./cloudFuncs/Auth/User')  // TODO: merge into auth
var activityFunc = require('./cloudFuncs/Activity')
var deviceFunc = require('./cloudFuncs/Device')
var PingppFunc = require('./cloudFuncs/Pingpp')
var orderFunc = require('./cloudFuncs/Order')
var mpJsSdkFuncs = require('./mpFuncs/JSSDK')
var stationFunc = require('./cloudFuncs/Station')
var accountsFunc= require('./cloudFuncs/Accounts')
var mpUserFuncs = require('./mpFuncs/User')
var promotionFunc = require('./cloudFuncs/Promotion')

/**
 * 云函数
 */
//用户
AV.Cloud.define('authFuncTest', authFunc.authFuncTest)
AV.Cloud.define('authFetchWalletInfo', authFunc.fetchWalletInfo)
AV.Cloud.define('authFetchDealRecords', authFunc.fetchDealRecords)
AV.Cloud.define('authVerifyIdName', authFunc.verifyIdName)
AV.Cloud.define('wechatIsSubscribe', mpUserFuncs.isSubscribe)

AV.Cloud.define('authFetchRolesAndPermissions', userFunc.authFetchRolesAndPermissions);
AV.Cloud.define('userListFetch', userFunc.userListFetch);
AV.Cloud.define('userCreate', userFunc.createUser);
AV.Cloud.define('userDelete', userFunc.deleteUser);
AV.Cloud.define('userUpdate', userFunc.updateUser);

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

AV.Cloud.define('promotionCreatePromotion', promotionFunc.createPromotion)
AV.Cloud.define('promotionFetchPromotions', promotionFunc.fetchPromotions)

//支付
AV.Cloud.define('pingppCreatePayment', PingppFunc.createPayment)
AV.Cloud.define('pingppPaymentEvent', PingppFunc.paymentEvent)
AV.Cloud.define('pingppCreateTransfer', PingppFunc.createTransfer)
AV.Cloud.define('pingppTransferEvent', PingppFunc.transferEvent)
AV.Cloud.define('pingppFetchRecharges', PingppFunc.fetchRecharges)

//订单
AV.Cloud.define('orderFuncTest', orderFunc.orderFuncTest)
AV.Cloud.define('orderFetchOwnsOrders', orderFunc.fetchOwnsOrders)
AV.Cloud.define('orderOrderPayment', orderFunc.orderPayment)
AV.Cloud.define('orderFetchOrders', orderFunc.fetchOrders)

//微信
AV.Cloud.define('getJsConfig', mpJsSdkFuncs.getJsConfig)

//结算
// AV.Cloud.define('selectDealData', accountsFunc.selectDealData)
// AV.Cloud.define('getYesterday', accountsFunc.getYesterday)
AV.Cloud.define('createStationDayAccount', accountsFunc.createStationDayAccount)
// AV.Cloud.define('getLastMonth', accountsFunc.getLastMonth)
AV.Cloud.define('getStationAccounts', accountsFunc.getStationAccounts)
AV.Cloud.define('getPartnerAccounts', accountsFunc.getPartnerAccounts)
AV.Cloud.define('getInvestorAccounts', accountsFunc.getInvestorAccounts)
AV.Cloud.define('getStationAccountsDetail', accountsFunc.getStationAccountsDetail)
AV.Cloud.define('getPartnerAccountsDetail', accountsFunc.getPartnerAccountsDetail)
AV.Cloud.define('getInvestorAccountsDetail', accountsFunc.getInvestorAccountsDetail)
// AV.Cloud.define('testMathjs', accountsFunc.testMathjs)


module.exports = AV.Cloud;
