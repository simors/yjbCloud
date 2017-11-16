var AV = require('leanengine')
var authFunc = require('./cloudFuncs/Auth')
var userFunc = require('./cloudFuncs/Auth/User')
var notificationFunc = require('./cloudFuncs/Notification')
var deviceFunc = require('./cloudFuncs/Device')
var PingppFunc = require('./cloudFuncs/Pingpp')
var orderFunc = require('./cloudFuncs/Order')
var mpJsSdkFuncs = require('./mpFuncs/JSSDK')
var stationFunc = require('./cloudFuncs/Station')
var accountsFunc= require('./cloudFuncs/Accounts')
var promotionFunc = require('./cloudFuncs/Promotion')
var excelFunc = require('./cloudFuncs/Util/excel')
var profitFunc = require('./cloudFuncs/Profit')
var utilFunc = require('./cloudFuncs/Util')
var operationFunc = require('./cloudFuncs/OperationLog')
var mpQrcodeFuncs = require('./mpFuncs/Qrcode')
var sysAuthFunc = require('./cloudFuncs/SysAuth')
var withdrawFunc = require('./cloudFuncs/Withdraw')

/**
 * 云函数
 */
//用户
AV.Cloud.define('authFuncTest', authFunc.authFuncTest)
AV.Cloud.define('authFetchWalletInfo', authFunc.fetchWalletInfo)
AV.Cloud.define('authVerifyIdName', authFunc.verifyIdName)
AV.Cloud.define('authSetUserMobilePhone', authFunc.setUserMobilePhone)
AV.Cloud.define('authUpdateUserRegion', authFunc.updateUserRegion)

AV.Cloud.define('authGetRolesAndPermissions', userFunc.authGetRolesAndPermissions);
AV.Cloud.define('authListEndUsers', userFunc.authListEndUsers);
AV.Cloud.define('authListAdminUsers', userFunc.authListAdminUsers);
AV.Cloud.define('authFetchAdminsByRoles', userFunc.authFetchAdminsByRoles);
AV.Cloud.define('authCreateUser', userFunc.authCreateUser);
AV.Cloud.define('authDeleteUser', userFunc.authDeleteUser);
AV.Cloud.define('authUpdateUser', userFunc.authUpdateUser);
AV.Cloud.define('authListOpenIdsTest', userFunc.authListOpenIdsTest);
AV.Cloud.define('authFetchUserByPhone', userFunc.reqFetchUserByPhone);

AV.Cloud.define('authStatMpUser', userFunc.authStatMpUser);

//消息推送
AV.Cloud.define('sendSystemNotification', notificationFunc.sendSystemNotification);
AV.Cloud.define('sendPromotionNotification', notificationFunc.sendPromotionNotification);

//设备
AV.Cloud.define('deviceFetchDeviceInfo', deviceFunc.fetchDeviceInfo)
AV.Cloud.define('deviceGenerateDeviceQrcode', deviceFunc.generateDeviceQrcode)
AV.Cloud.define('deviceFuncTest', deviceFunc.deviceFuncTest)
AV.Cloud.define('deviceFetchDevices', deviceFunc.fetchDevices)
AV.Cloud.define('deviceChangeDeviceStatus', deviceFunc.changeDeviceStatus)
AV.Cloud.define('deviceAssociateWithStation', deviceFunc.associateWithStation)
AV.Cloud.define('deviceUpdateDevice', deviceFunc.updateDevice)
AV.Cloud.define('deviceStatDevice', deviceFunc.statDevice)

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
AV.Cloud.define('stationAdminHaveStation', stationFunc.adminHaveStation)
AV.Cloud.define('stationInvestorHaveStation', stationFunc.investorHaveStation)
AV.Cloud.define('stationPartnerHaveStation', stationFunc.partnerHaveStation)
AV.Cloud.define('stationValidProfitSharing', stationFunc.validProfitSharing)

AV.Cloud.define('userFuncTest', stationFunc.userFuncTest)
AV.Cloud.define('stationFetchProfitSharebyUser', stationFunc.reqFetchProfitSharebyUser)
AV.Cloud.define('stationFetchStationStat', stationFunc.statStation)

//营销活动
AV.Cloud.define('promCreatePromotion', promotionFunc.createPromotion)
AV.Cloud.define('promFetchPromotions', promotionFunc.fetchPromotions)
AV.Cloud.define('promFetchPromotionCategoryList', promotionFunc.fetchPromotionCategoryList)
AV.Cloud.define('promEditPromotion', promotionFunc.editPromotion)
AV.Cloud.define('promGetValidPromotionList', promotionFunc.getValidPromotionList)
AV.Cloud.define('promFetchPromotionRecord', promotionFunc.fetchPromotionRecord)
AV.Cloud.define('promGetScoreExchangePromotion', promotionFunc.getScoreExchangePromotion)
AV.Cloud.define('promExchangeGift', promotionFunc.exchangeGift)
AV.Cloud.define('promGetValidScoreExProm', promotionFunc.getValidScoreExProm)
AV.Cloud.define('promotionFuncTest', promotionFunc.promotionFuncTest)

//支付
AV.Cloud.define('pingppCreatePayment', PingppFunc.createPayment)
AV.Cloud.define('pingppPaymentEvent', PingppFunc.paymentEvent)
AV.Cloud.define('pingppCreateTransfer', PingppFunc.createTransfer)
AV.Cloud.define('pingppTransferEvent', PingppFunc.transferEvent)
AV.Cloud.define('pingppFetchDealRecord', PingppFunc.fetchDealRecord)
AV.Cloud.define('pingppFetchDepositAmount', PingppFunc.fetchDepositAmount)
AV.Cloud.define('pingppFetchRechargeAmount', PingppFunc.fetchRechargeAmount)
AV.Cloud.define('pingppFuncTest', PingppFunc.pingppFuncTest)

//订单
AV.Cloud.define('orderFuncTest', orderFunc.orderFuncTest)
AV.Cloud.define('orderFetchOwnsOrders', orderFunc.fetchOwnsOrders)
AV.Cloud.define('orderOrderPayment', orderFunc.orderPayment)
AV.Cloud.define('orderFetchOrders', orderFunc.fetchOrders)

//微信
AV.Cloud.define('getJsConfig', mpJsSdkFuncs.getJsConfig)

//结算
AV.Cloud.define('accountCreateStationDayAccount', accountsFunc.createStationDayAccount)
AV.Cloud.define('accountGetStationAccounts', accountsFunc.getStationAccounts)
AV.Cloud.define('accountGetPartnerAccounts', accountsFunc.getPartnerAccounts)
AV.Cloud.define('accountGetInvestorAccounts', accountsFunc.getInvestorAccounts)
AV.Cloud.define('accountGetStationAccountsDetail', accountsFunc.getStationAccountsDetail)
AV.Cloud.define('accountGetPartnerAccountsDetail', accountsFunc.getPartnerAccountsDetail)
AV.Cloud.define('accountGetInvestorAccountsDetail', accountsFunc.getInvestorAccountsDetail)
AV.Cloud.define('accountGetPlatformAccount', accountsFunc.getPlatformAccount)
AV.Cloud.define('accountTestFunc', accountsFunc.accountTestFunc)
AV.Cloud.define('accountStatLast30DaysAccountProfit', accountsFunc.reqStatLast30DaysAccountProfit)
AV.Cloud.define('accountStatLast3MonthsAccountProfit', accountsFunc.reqStatLast3MonthsAccountProfit)
AV.Cloud.define('accountStatLastHalfYearAccountProfit', accountsFunc.reqStatLastHalfYearAccountProfit)
AV.Cloud.define('accountStatLast1YearAccountProfit', accountsFunc.reqStatLast1YearAccountProfit)
AV.Cloud.define('accountStatAccountProfit', accountsFunc.reqStatAccountProfit)
AV.Cloud.define('accountStatPlatformAccount', accountsFunc.reqStatPlatformAccount)
AV.Cloud.define('accountFetchStationAccountRank', accountsFunc.reqFetchStationAccountRank)

AV.Cloud.define('stationAccountToExcel', excelFunc.stationAccountToExcel)

//Util
AV.Cloud.define('utilFuncTest', utilFunc.utilFuncTest)

// 投资收益
AV.Cloud.define('profitQueryProfit', profitFunc.reqAdminProfit)
AV.Cloud.define('profitTestIncProfit', profitFunc.reqTestIncProfit)
AV.Cloud.define('profitTestDecProfit', profitFunc.reqTestDecProfit)
AV.Cloud.define('profitTestUpdateAdminProfitProcess', profitFunc.reqTestUpdateAdminProfitProcess)
AV.Cloud.define('profitTestJudgeWithdraw', profitFunc.reqTestJudgeWithdraw)

//操作日志
AV.Cloud.define('operationFetchOperationLogs', operationFunc.fetchOperationLogs)

// 微信二维码
AV.Cloud.define('wechatGenerateUserQrcode', mpQrcodeFuncs.reqGenerateUserQRCode)

//Hook函数
AV.Cloud.onLogin(authFunc.onLogin)

// 系统管理员操作认证
AV.Cloud.define('sysauthSendAuthCode', sysAuthFunc.reqSendAuthCode)
AV.Cloud.define('sysauthVerifyAuthCode', sysAuthFunc.reqVerifyAuthCode)

// 取现与退押金
AV.Cloud.define('withdrawCreateApply', withdrawFunc.createWithdrawApply)
AV.Cloud.define('withdrawFetchApply', withdrawFunc.fetchWithdrawRecords)
AV.Cloud.define('withdrawFetchLastRefund', withdrawFunc.fetchUserLastRefund)

module.exports = AV.Cloud;
