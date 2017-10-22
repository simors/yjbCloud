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
var excelFunc = require('./cloudFuncs/Util/excel')
var profitFunc = require('./cloudFuncs/Profit')
var utilFunc = require('./cloudFuncs/Util')
var operationFunc = require('./cloudFuncs/OperationLog')

/**
 * 云函数
 */
//用户
AV.Cloud.define('authFuncTest', authFunc.authFuncTest)
AV.Cloud.define('authFetchWalletInfo', authFunc.fetchWalletInfo)
AV.Cloud.define('authFetchDealRecords', authFunc.fetchDealRecords)
AV.Cloud.define('authVerifyIdName', authFunc.verifyIdName)
AV.Cloud.define('wechatIsSubscribe', mpUserFuncs.isSubscribe)
AV.Cloud.define('authSetUserMobilePhone', authFunc.setUserMobilePhone)

AV.Cloud.define('authGetRolesAndPermissions', userFunc.authGetRolesAndPermissions);
AV.Cloud.define('authListEndUsers', userFunc.authListEndUsers);
AV.Cloud.define('authListAdminUsers', userFunc.authListAdminUsers);
AV.Cloud.define('authCreateUser', userFunc.authCreateUser);
AV.Cloud.define('authDeleteUser', userFunc.authDeleteUser);
AV.Cloud.define('authUpdateUser', userFunc.authUpdateUser);

//设备
AV.Cloud.define('deviceFetchDeviceInfo', deviceFunc.fetchDeviceInfo)
AV.Cloud.define('deviceGenerateDeviceQrcode', deviceFunc.generateDeviceQrcode)
AV.Cloud.define('deviceFuncTest', deviceFunc.deviceFuncTest)
AV.Cloud.define('deviceFetchDevices', deviceFunc.fetchDevices)
AV.Cloud.define('deviceChangeDeviceStatus', deviceFunc.changeDeviceStatus)
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
AV.Cloud.define('stationFetchProfitSharebyUser', stationFunc.reqFetchProfitSharebyUser)

//营销活动
AV.Cloud.define('activityIncrActivityPageView', activityFunc.incrActivityPageView)
AV.Cloud.define('activityCreateActivity', activityFunc.createActivity)
AV.Cloud.define('activityDeleteActivity', activityFunc.deleteActivity)
AV.Cloud.define('activityGetActivitiesList', activityFunc.getActivitiesList)

AV.Cloud.define('promCreatePromotion', promotionFunc.createPromotion)
AV.Cloud.define('promFetchPromotions', promotionFunc.fetchPromotions)
AV.Cloud.define('promFetchPromotionCategoryList', promotionFunc.fetchPromotionCategoryList)
AV.Cloud.define('promEditPromotion', promotionFunc.editPromotion)
AV.Cloud.define('promGetValidPromotionList', promotionFunc.getValidPromotionList)
AV.Cloud.define('promFetchRechargePromRecord', promotionFunc.fetchRechargePromRecord)
AV.Cloud.define('promotionFuncTest', promotionFunc.promotionFuncTest)

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
AV.Cloud.define('accountCreateStationDayAccount', accountsFunc.createStationDayAccount)
// AV.Cloud.define('getLastMonth', accountsFunc.getLastMonth)
AV.Cloud.define('accountGetStationAccounts', accountsFunc.getStationAccounts)
AV.Cloud.define('accountGetPartnerAccounts', accountsFunc.getPartnerAccounts)
AV.Cloud.define('accountGetInvestorAccounts', accountsFunc.getInvestorAccounts)
AV.Cloud.define('accountGetStationAccountsDetail', accountsFunc.getStationAccountsDetail)
AV.Cloud.define('accountGetPartnerAccountsDetail', accountsFunc.getPartnerAccountsDetail)
AV.Cloud.define('accountGetInvestorAccountsDetail', accountsFunc.getInvestorAccountsDetail)
AV.Cloud.define('accountGetDayAccountsSum', accountsFunc.getDayAccountsSum)
AV.Cloud.define('accountStatLast30DaysInvestorProfit', accountsFunc.reqStatLast30DaysInvestorProfit)
AV.Cloud.define('accountStatInvestorProfit', accountsFunc.reqStatInvestorProfit)
AV.Cloud.define('accountStatPartnerProfit', accountsFunc.reqStatPartnerProfit)
AV.Cloud.define('accountStatLast30DaysPartnerProfit', accountsFunc.reqStatLast30DaysPartnerProfit)

// AV.Cloud.define('testMathjs', accountsFunc.testMathjs)
AV.Cloud.define('stationAccountToExcel', excelFunc.stationAccountToExcel)

//Util
AV.Cloud.define('utilFuncTest', utilFunc.utilFuncTest)

// 投资收益
AV.Cloud.define('profitQueryProfit', profitFunc.reqAdminProfit)
AV.Cloud.define('profitTestIncProfit', profitFunc.reqTestIncProfit)
AV.Cloud.define('profitTestDecProfit', profitFunc.reqTestDecProfit)

//操作日志
AV.Cloud.define('operationFetchOperationLogs', operationFunc.fetchOperationLogs)


module.exports = AV.Cloud;
