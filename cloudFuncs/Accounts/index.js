/**
 * Created by lilu on 2017/9/28.
 */
var mysqlUtil = require('../Util/mysqlUtil')
var AuthFuncs = require('../Auth')
var OrderFunc = require('../Order')
var DeviceFuncs = require('../Device')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')
var mathjs = require('mathjs')
var dateFormat = require('dateformat')
var StationFuncs = require('../Station')
import AV from 'leanengine'
import * as errno from '../errno'
import moment from 'moment'
var ProfitFuncs = require('../Profit')
import {ROLE_CODE} from '../../rolePermission'

const ACCOUNT_TYPE = {
  INVESTOR_ACCOUNT: 1,
  PARTNER_ACCOUNT: 2,
}

const ERR_LOG_TYPE = {
  FINISH: 1,
  UNTREAT: 2
}

//服务点日结数据构造方法
function constructStationAccountnInfo(account, includeStation) {
  if (!account) {
    return undefined
  }
  let constructStationInfo = StationFuncs.constructStationInfo
  let accountInfo = {}

  let station = account.attributes.station
  accountInfo.id = account.id
  accountInfo.accountDay = account.attributes.accountDay
  accountInfo.profit = account.attributes.profit
  accountInfo.cost = account.attributes.cost
  accountInfo.incoming = account.attributes.incoming
  accountInfo.platformProfit = account.attributes.platformProfit
  accountInfo.partnerProfit = account.attributes.partnerProfit
  accountInfo.investorProfit = account.attributes.investorProfit
  accountInfo.powerUnitPrice = account.attributes.powerUnitPrice
  accountInfo.stationId = station ? station.id : undefined
  if (includeStation && station) {
    accountInfo.station = constructStationInfo(station)
  }
  accountInfo.createdAt = account.createdAt
  return accountInfo
}

/**
 * AccountProfit转换方法
 *
 * @param lcProfitAccount
 * @param includeStation
 * @param includeUser
 * @param includeStationAccount
 * @param includeProfitSharing
 * @returns {*}
 */
function constructAccountProfit(lcProfitAccount, includeStation, includeUser, includeStationAccount, includeProfitSharing) {
  if (!lcProfitAccount) {
    return undefined
  }

  let constructStationInfo = StationFuncs.constructStationInfo
  let constructProfitSharing = StationFuncs.constructProfitSharing
  let constructUserInfo = require('../Auth').constructUserInfo
  let profitAccount = {}

  let accountAttr = lcProfitAccount.attributes
  if (!accountAttr) {
    return undefined
  }
  profitAccount.id = lcProfitAccount.id
  profitAccount.userId = accountAttr.user ? accountAttr.user.id : undefined
  profitAccount.stationId = accountAttr.station ? accountAttr.station.id : undefined
  profitAccount.stationAccountId = accountAttr.stationAccount ? accountAttr.stationAccount.id : undefined
  profitAccount.profitSharingId = accountAttr.profitSharing ? accountAttr.profitSharing.id : undefined
  profitAccount.profit = accountAttr.profit
  profitAccount.accountDay = accountAttr.accountDay
  profitAccount.accountType = accountAttr.accountType
  profitAccount.createdAt = lcProfitAccount.createdAt
  profitAccount.updatedAt = lcProfitAccount.updatedAt

  if (includeStation) {
    profitAccount.station = constructStationInfo(accountAttr.station, false)
  }

  if (includeStationAccount) {
    profitAccount.stationAccount = constructStationAccountnInfo(accountAttr.stationAccount, false)
  }

  if (includeProfitSharing) {
    profitAccount.profitSharing = constructProfitSharing(accountAttr.profitSharing, false, false)
  }

  if (includeUser) {
    profitAccount.user = constructUserInfo(accountAttr.user)
  }

  return profitAccount
}

//查询昨天日期
function getYesterday() {
  var today = new Date().toLocaleDateString();
  today = new Date(today)
  var oneday = 1000 * 60 * 60 * 24;
  var yesterday = new Date(today - oneday);
  return {today: today, yesterday: yesterday}
}

//查询该设备下的1000个订单收益的和
async function selectAmountSumBydeviceId(device, dayInfo) {
  let usePowerSum = 0
  let powerSum = 0
  let amountSum = 0
  try {
    let useTime = 0
    let orderList = await OrderFunc.getOrders(device.id, dayInfo.yesterday, dayInfo.today)
    if (orderList && orderList.length > 0) {
      orderList.forEach((order)=> {
        if (order.amount) {
          let endTime = new Date(order.endTime)
          let startTime = new Date(order.createTime)
          let lastTime = mathjs.round(mathjs.chain(endTime - startTime).multiply(1 / 3600000).done(), 3)
          useTime = mathjs.chain(useTime).add(lastTime).done()
          amountSum = mathjs.chain(amountSum).add(order.amount).done()
        }

      })
    }
    usePowerSum = mathjs.chain(useTime).multiply(device.usePower).done()
    let standbyPowerSum = mathjs.round(mathjs.chain(device.standbyPower).multiply(24 - useTime).done(), 2)
    powerSum = mathjs.chain(usePowerSum).add(standbyPowerSum).done()
    return {amountSum: amountSum, powerSum: powerSum}
  } catch (error) {
    throw error
  }
}

//查询单个服务点当天收益并生成日结数据插入Account表中
async function createStationAccount(station, dayInfo) {
  let amountSum = 0
  let cost = 0
  let powerSum = 0
  let profit = 0
  try {
    let deviceList = await DeviceFuncs.getDevices(station.id)
    for (let i = 0; i < deviceList.length; i++) {
      let result = await selectAmountSumBydeviceId(deviceList[i], dayInfo)
      amountSum = mathjs.round(mathjs.chain(amountSum).add(result.amountSum).done(), 2)
      powerSum = mathjs.round(mathjs.chain(powerSum).add(result.powerSum).done(), 2)
    }
    let stationInfo = AV.Object.createWithoutData('Station', station.id)
    let Account = AV.Object.extend('StationAccount')
    let account = new Account()
    cost = mathjs.round(mathjs.chain(station.powerUnitPrice).multiply(powerSum).multiply(1/1000).done(), 2)
    profit = mathjs.round(mathjs.chain(amountSum).subtract(cost).done(), 2)
    account.set('incoming', amountSum)
    account.set('station', stationInfo)
    account.set('accountDay', dayInfo.yesterday)
    account.set('cost', cost)
    account.set('profit', profit)
    let accountInfo = await account.save()
    let newStationAccount = await createPartnerAccount(accountInfo.id, dayInfo)
    return newStationAccount
  } catch (error) {
    throw error
  }
}

//根据服务点日结数据生成分成方和投资人日结数据
async function createPartnerAccount(accountId, dayInfo) {
  let partnerProfit = 0
  let investorProfit = 0
  let platfomProfit = 0
  try {
    let queryAccount = new AV.Query('StationAccount')
    queryAccount.include(['station'])
    let stationAccount = await queryAccount.get(accountId)
    let stationAccountInfo = constructStationAccountnInfo(stationAccount, true)
    if(stationAccountInfo.profit>0){
      platfomProfit  = mathjs.round(mathjs.chain(stationAccountInfo.profit).multiply(stationAccountInfo.station.platformProp).done(), 2)
    }else{
      platfomProfit = stationAccountInfo.profit
    }


    let station = AV.Object.createWithoutData('Station', stationAccountInfo.stationId)
    let stationAccountObject = AV.Object.createWithoutData('StationAccount', accountId)
    let partnerList = await StationFuncs.getPartnerByStationId(stationAccountInfo.stationId)
    if (partnerList && partnerList.length > 0) {
      for (let i = 0; i < partnerList.length; i++) {
        let partner = partnerList[i]
        let user = AV.Object.createWithoutData('_User', partner.shareholderId)
        let profitSharing = AV.Object.createWithoutData('ProfitSharing', partner.id)
        let PartnerAccount = AV.Object.extend('AccountProfit')
        let partnerAccount = new PartnerAccount()
        let profit = 0
        partnerAccount.set('stationAccount', stationAccountObject)
        if(stationAccountInfo.profit>0){
          profit = mathjs.round(mathjs.chain(stationAccountInfo.profit).multiply(partner.royalty).done(), 2)
        }
        partnerAccount.set('profit', profit)
        partnerAccount.set('accountDay', dayInfo.yesterday)
        partnerAccount.set('profitSharing', profitSharing)
        partnerAccount.set('station', station)
        partnerAccount.set('user', user)
        partnerAccount.set('accountType', ACCOUNT_TYPE.PARTNER_ACCOUNT)
        await partnerAccount.save()
        await ProfitFuncs.incAdminProfit(partner.shareholderId, ACCOUNT_TYPE.PARTNER_ACCOUNT, profit)
        partnerProfit = mathjs.round(mathjs.chain(partnerProfit).add(profit).done(), 2)
      }
    }
    let investorList = await StationFuncs.getInvestorByStationId(stationAccountInfo.stationId)
    if(stationAccountInfo.profit>0){
      investorProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).subtract(platfomProfit).subtract(partnerProfit).done(), 2)
    }
    if (investorList && investorList.length > 0) {
      for (let i = 0; i < investorList.length; i++) {
        let investor = investorList[i]
        let user = AV.Object.createWithoutData('_User', investor.shareholderId)
        let profitSharing = AV.Object.createWithoutData('ProfitSharing', investor.id)
        let InvestorAccount = AV.Object.extend('AccountProfit')
        let investorAccount = new InvestorAccount()
        investorAccount.set('stationAccount', stationAccountObject)
        let profit = mathjs.round(mathjs.chain(investorProfit).multiply(investor.royalty).done(), 2)
        investorAccount.set('profit', profit)
        investorAccount.set('accountDay', dayInfo.yesterday)
        investorAccount.set('profitSharing', profitSharing)
        investorAccount.set('station', station)
        investorAccount.set('user', user)
        investorAccount.set('accountType', ACCOUNT_TYPE.INVESTOR_ACCOUNT)
        await investorAccount.save()
        await ProfitFuncs.incAdminProfit(investor.shareholderId, ACCOUNT_TYPE.INVESTOR_ACCOUNT, profit)
      }
    } else {
      investorProfit = 0
      platfomProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).subtract(partnerProfit).done(), 2)
    }
    stationAccountObject.set('investorProfit', investorProfit)
    stationAccountObject.set('partnerProfit', partnerProfit)
    stationAccountObject.set('platformProfit', platfomProfit)
    let stationInfo = await stationAccountObject.save(null, {fetchWhenSave: true})
    let queryNewStation = new AV.Query('StationAccount')
    let newStationInfo = queryNewStation.get(stationInfo.id)
    return newStationInfo
  } catch (err) {
    throw err
  }

}

//生成服务点日结数据
async function createStationDayAccount() {
  let cost = 0
  let profit = 0
  let incoming = 0
  let platformProfit = 0
  let partnerProfit = 0
  let investorProfit = 0
  let lastTime = undefined
  let dayInfo = getYesterday()
  try {
    while (1) {
      let stationList = await StationFuncs.getStations(lastTime)
      if (stationList.length < 1) {
        break
      }
      for (let i = 0; i < stationList.length; i++) {
        let stationAccount = await createStationAccount(stationList[i], dayInfo)
        let attr = stationAccount.attributes
        cost = mathjs.chain(cost).add(attr.cost).done()
        profit = mathjs.chain(profit).add(attr.profit).done()
        incoming = mathjs.chain(incoming).add(attr.incoming).done()
        platformProfit = mathjs.chain(platformProfit).add(attr.platformProfit).done()
        partnerProfit = mathjs.chain(partnerProfit).add(attr.partnerProfit).done()
        investorProfit = mathjs.chain(investorProfit).add(attr.investorProfit).done()
      }
      lastTime = stationList[stationList.length - 1].createdAt
    }

    let DayAccount = AV.Object.extend('DayAccountSum')
    let dayAccount = new DayAccount()
    dayAccount.set('cost', cost)
    dayAccount.set('profit', profit)
    dayAccount.set('incoming', incoming)
    dayAccount.set('platformProfit', platformProfit)
    dayAccount.set('partnerProfit', partnerProfit)
    dayAccount.set('investorProfit', investorProfit)
    dayAccount.set('accountDay', new Date(dayInfo.yesterday))
    await dayAccount.save()
    return true
  } catch (error) {
    console.log(error)
    recordAccountError(dayInfo, '生成日结记录失败')
  }
}

//生成上月时间第一天和最后一天
function getLastMonth() {
  var nowdays = new Date().toLocaleDateString();
  nowdays = new Date(nowdays)
  var lastDay = new Date().toLocaleDateString()
  lastDay = new Date(lastDay).setDate(1)
  var year = nowdays.getFullYear();
  var month = nowdays.getMonth();
  if (month == 0) {
    month = 12;
    year = year - 1;
  }
  if (month < 10) {
    month = "0" + month;
  }
  var firstDay = year + "-" + month + "-" + "01";//上个月的第一天
  return {firstDay: new Date(firstDay), lastDay: new Date(lastDay)}
}

//服务点结算查询
async function getStationAccounts(request, response) {
  let stationId = request.params.stationId
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let query = new AV.Query('Station')
  if (stationId) {
    query.equalTo('objectId', stationId)
  }
  try {
    let stations = await query.find()
    let accountList = []
    for (let i = 0; i < stations.length; i++) {
      let account = await getAccountByStationId(stations[i].id, startDate, endDate)
      if (account && account.stationId) {
        accountList.push(account)
      }
    }
    response.success({accountList: accountList})
  } catch (error) {
    throw error
  }
}

//查询每个服务点的收益结算
async function getAccountByStationId(stationId, startDate, endDate) {
  let query = undefined
  let lastCreatedAt = undefined
  let incoming = 0
  let profit = 0
  let cost = 0
  let platformProfit = 0
  let partnerProfit = 0
  let investorProfit = 0
  if (startDate && !endDate) {
    query = new AV.Query('StationAccount')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('StationAccount')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('StationAccount')
    let endQuery = new AV.Query('StationAccount')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('StationAccount')
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  query.include(['station', 'station.admin'])
  query.limit(1000)
  query.descending('createdAt')
  let accountInfo = {}
  try {
    while (1) {
      if (lastCreatedAt) {
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let accounts = await query.find()
      if (accounts.length < 1) {
        break
      }
      accounts.forEach((account) => {
        if (account) {
          incoming = mathjs.round(mathjs.chain(incoming).add(account.attributes.incoming).done(), 2)
          profit = mathjs.round(mathjs.chain(profit).add(account.attributes.profit).done(), 2)
          cost = mathjs.round(mathjs.chain(cost).add(account.attributes.cost).done(), 2)
          platformProfit = mathjs.round(mathjs.chain(platformProfit).add(account.attributes.platformProfit).done(), 2)
          partnerProfit = mathjs.round(mathjs.chain(partnerProfit).add(account.attributes.partnerProfit).done(), 2)
          investorProfit = mathjs.round(mathjs.chain(investorProfit).add(account.attributes.investorProfit).done(), 2)
        }
        accountInfo = constructStationAccountnInfo(account, true)
      })
      lastCreatedAt = accounts[accounts.length - 1].createdAt.valueOf()
    }
    if (accountInfo && accountInfo.stationId) {
      accountInfo.incoming = incoming
      accountInfo.profit = profit
      accountInfo.cost = cost
      accountInfo.platformProfit = platformProfit
      accountInfo.partnerProfit = partnerProfit
      accountInfo.investorProfit = investorProfit
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      return accountInfo
    } else {
      return accountInfo
    }
  } catch (error) {
    console.log("getAccounts", error)
    throw error
  }
}

/**
 * 获取分成方的结算统计
 * @param {}
 */
async function getPartnerAccounts(request, response) {
  let stationId = request.params.stationId
  let userId = request.params.userId
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let lastCreatedAt = request.params.lastCreatedAt
  let partners = []
  try {
    if (userId) {
     partners.push({id:userId})
    }else if(stationId){
      let partnerList = await StationFuncs.getPartnerByStationId(stationId)
      partnerList.forEach((item)=>{
        partners.push({id:item.shareholderId})
      })
    }else{
      let roles = []
      roles.push(ROLE_CODE.STATION_PROVIDER)
      partners = await getUsersByRoles(roles,lastCreatedAt)
    }
    let accountList = []
    for (let i = 0; i < partners.length; i++) {
      let account = await getAccountsByPartnerId(partners[i].id, stationId, startDate, endDate)
      if (account&& account.userId  ) {
        accountList.push(account)
      }
    }
    response.success({accountList: accountList})
  } catch (error) {
    throw error
  }
}

/**
 * 获取单个分成方的结算统计
 * @param {}
 */
async function getAccountsByPartnerId(partnerId, stationId, startDate, endDate) {
  let query = undefined
  let lastCreatedAt = undefined
  let profit = 0
  if (startDate && !endDate) {
    query = new AV.Query('AccountProfit')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('AccountProfit')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('AccountProfit')
    let endQuery = new AV.Query('AccountProfit')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('AccountProfit')
  }
  query.equalTo('accountType', ACCOUNT_TYPE.PARTNER_ACCOUNT)
  if (partnerId) {
    let partner = AV.Object.createWithoutData('_User', partnerId)
    query.equalTo('user', partner)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  query.include(['station', 'station.admin', 'user'])
  query.limit(1000)
  query.descending('createdAt')
  let accountInfo = {}
  try {
    while (1) {
      if (lastCreatedAt) {
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let accounts = await query.find()
      if (accounts.length < 1) {
        break
      }
      accounts.forEach((account) => {
        if (account) {
          profit = mathjs.round(mathjs.chain(profit).add(account.attributes.profit).done(), 2)
          accountInfo = constructAccountProfit(account, true, true)
        }
      })
      lastCreatedAt = accounts[accounts.length - 1].createdAt.valueOf()
    }
    if (accountInfo && accountInfo.userId ) {
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      accountInfo.profit = profit
      if(!stationId){
        accountInfo.station = undefined
        accountInfo.stationId = undefined
      }
      return accountInfo
    } else {
      return accountInfo
    }
  } catch (error) {
    console.log("getAccounts", error)
    throw error
  }
}


/**
 * 获取投资人的结算统计
 * @param {}
 */
async function getInvestorAccounts(request, response) {
  let stationId = request.params.stationId
  let userId = request.params.userId
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let lastCreatedAt = request.params.lastCreatedAt
  let partners = []

  try {
    if (userId) {
      partners.push({id:userId})
    }else if(stationId){
      let partnerList = await StationFuncs.getInvestorByStationId(stationId)
      partnerList.forEach((item)=>{
        partners.push({id:item.shareholderId})
      })
    }else{
      let roles = []
      roles.push(ROLE_CODE.STATION_INVESTOR)
      partners = await getUsersByRoles(roles,lastCreatedAt)
    }
    let accountList = []
    for (let i = 0; i < partners.length; i++) {
      let account = await getAccountsByInvestorId(partners[i].id, stationId, startDate, endDate)
      if (account && account.userId) {
        accountList.push(account)
      }
    }
    response.success({accountList: accountList})
  } catch (error) {
    throw error
  }
}

/**
 * 获取单个投资人的结算统计
 * @param {}
 */
async function getAccountsByInvestorId(investorId, stationId, startDate, endDate) {
  let query = undefined
  let lastCreatedAt = undefined
  let profit = 0
  if (startDate && !endDate) {
    query = new AV.Query('AccountProfit')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('AccountProfit')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('AccountProfit')
    let endQuery = new AV.Query('AccountProfit')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('AccountProfit')
  }
  query.equalTo('accountType', ACCOUNT_TYPE.INVESTOR_ACCOUNT)
  if (investorId) {
    let investor = AV.Object.createWithoutData('_User', investorId)
    query.equalTo('user', investor)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  query.include(['station', 'station.admin', 'user'])
  query.limit(1000)
  query.descending('createdAt')
  let accountInfo = {}
  try {
    while (1) {
      if (lastCreatedAt) {
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let accounts = await query.find()
      if (accounts.length < 1) {
        break
      }
      accounts.forEach((account) => {
        if (account) {
          profit = mathjs.round(mathjs.chain(profit).add(account.attributes.profit).done(), 2)
          accountInfo = constructAccountProfit(account, true, true)
        }
      })
      lastCreatedAt = accounts[accounts.length - 1].createdAt.valueOf()
    }
    if (accountInfo&& accountInfo.userId) {
      accountInfo.profit = profit
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      if(!stationId){
        accountInfo.stationId = undefined
        accountInfo.station = undefined
      }
      return accountInfo
    } else {
      return accountInfo
    }
  } catch (error) {
    console.log("getAccounts", error)
    throw error
  }
}

/*
 * 获取服务点日结信息
 * @ params {}
 */
async function getStationAccountsDetail(request, response) {
  let stationId = request.params.stationId
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let lastCreatedAt = request.params.lastCreatedAt
  let query = undefined

  if (startDate && !endDate) {
    query = new AV.Query('StationAccount')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('StationAccount')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('StationAccount')
    let endQuery = new AV.Query('StationAccount')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('StationAccount')
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.descending('createdAt')
  query.include(['station,station.admin'])
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((account)=> {
      let accountInfo = constructStationAccountnInfo(account, true)
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      accountList.push(accountInfo)
    })
    response.success(accountList)
  } catch (error) {
    response.error(error)
  }
}


/*
 * 获取分成平台日结信息
 * @ params {}
 */
async function getPartnerAccountsDetail(request, response) {
  let stationId = request.params.stationId
  let userId = request.params.userId
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let lastCreatedAt = request.params.lastCreatedAt
  let query = undefined
  if (startDate && !endDate) {
    query = new AV.Query('AccountProfit')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('AccountProfit')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('AccountProfit')
    let endQuery = new AV.Query('AccountProfit')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('AccountProfit')
  }
  if (userId) {
    let user = AV.Object.createWithoutData('_User', userId)
    query.equalTo('user', user)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.equalTo('accountType', ACCOUNT_TYPE.PARTNER_ACCOUNT)
  query.descending('createdAt')
  query.include(['station', 'user'])
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((account)=> {
      let accountInfo = constructAccountProfit(account, true,true)
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      accountList.push(accountInfo)
    })
    response.success(accountList)
  } catch (error) {
    response.error(error)
  }
}


/*
 * 获取投资人日结信息
 * @ params {}
 */
async function getInvestorAccountsDetail(request, response) {
  let stationId = request.params.stationId
  let startDate = request.params.startDate
  let userId = request.params.userId
  let endDate = request.params.endDate
  let lastCreatedAt = request.params.lastCreatedAt
  let query = undefined
  if (startDate && !endDate) {
    query = new AV.Query('AccountProfit')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('AccountProfit')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('AccountProfit')
    let endQuery = new AV.Query('AccountProfit')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('AccountProfit')
  }
  if (userId) {
    let user = AV.Object.createWithoutData('_User', userId)
    query.equalTo('user', user)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.equalTo('accountType', ACCOUNT_TYPE.INVESTOR_ACCOUNT)
  query.descending('createdAt')
  query.include(['station', 'user'])
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((account)=> {
      let accountInfo = constructAccountProfit(account, true,true)
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      accountList.push(accountInfo)
    })
    response.success(accountList)
  } catch (error) {
    response.error(error)
  }
}

/*
 * 获取总和日结信息
 * @ params {}
 */
async function getDayAccountsSum(request, response) {
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let limit = request.params.limit || 30
  let lastCreatedAt = request.params.lastCreatedAt
  let query = undefined

  if (startDate && !endDate) {
    query = new AV.Query('DayAccountSum')
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  } else if (endDate && !startDate) {
    query = new AV.Query('DayAccountSum')
    query.lessThan('accountDay', new Date(endDate))
  } else if (startDate && endDate) {
    let startQuery = new AV.Query('DayAccountSum')
    let endQuery = new AV.Query('DayAccountSum')
    startQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))
    endQuery.lessThan('accountDay', new Date(endDate))
    query = AV.Query.and(startQuery, endQuery)
  } else {
    query = new AV.Query('DayAccountSum')
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.limit(limit)
  query.descending('createdAt')
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((item)=>{
      let accountInfo = constructStationAccountnInfo(item,true)
      accountInfo.startDate = startDate
      accountInfo.endDate = endDate
      accountList.push(accountInfo)

  })
    response.success(accountList)
  } catch (error) {
    response.error(error)
  }
}

/**
 * 根据收益结算类型获取某段时间内在所有服务点的投资收益列表
 * @param user        完整的_User用户对象
 * @param type        统计的类型，取值为ACCOUNT_TYPE类型数据
 * @param startDate   起始时间
 * @param endDate     截止时间
 * @returns {Array}   返回统计列表
 */
async function statAccountProfit(user, type, startDate, endDate) {
  let beginQuery = new AV.Query('AccountProfit')
  beginQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))

  let endQuery = new AV.Query('AccountProfit')
  endQuery.lessThanOrEqualTo('accountDay', new Date(endDate))

  let query = AV.Query.and(beginQuery, endQuery)
  query.ascending('accountDay')
  query.equalTo('user', user)
  query.equalTo('accountType', type)
  query.include('station')
  let result = await query.find()
  let profits = []
  result.forEach((profit) => {
    profits.push(constructAccountProfit(profit, true, false, false, false))
  })
  return profits
}

/**
 * 获取投资收益的网络接口
 * @param request
 * @returns {Array}
 */
async function reqStatAccountProfit(request) {
  let currentUser = request.currentUser
  let type = request.params.accountType
  let startDate = request.params.startDate
  let endDate = request.params.endDate

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statAccountProfit(currentUser, type, startDate, endDate)
}

/**
 * 获取服务点投资人在过去30天所有服务点的投资收益
 * @param request
 * @returns {Array}
 */
async function reqStatLast30DaysAccountProfit(request) {
  let currentUser = request.currentUser
  let type = request.params.accountType

  let startDate = moment().subtract(30, 'days').format('YYYY-MM-DD')
  let endDate = moment().format('YYYY-MM-DD')

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statAccountProfit(currentUser, type, startDate, endDate)
}

/**
 * 获取服务点投资人在过去3个月所有服务点的投资收益
 * @param request
 * @returns {Array}
 */
async function reqStatLast3MonthsAccountProfit(request) {
  let currentUser = request.currentUser
  let type = request.params.accountType

  let startDate = moment().subtract(3, 'months').format('YYYY-MM-DD')
  let endDate = moment().format('YYYY-MM-DD')

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statAccountProfit(currentUser, type, startDate, endDate)
}

/**
 * 获取服务点投资人在过去半年所有服务点的投资收益
 * @param request
 * @returns {Array}
 */
async function reqStatLastHalfYearAccountProfit(request) {
  let currentUser = request.currentUser
  let type = request.params.accountType

  let startDate = moment().subtract(6, 'months').format('YYYY-MM-DD')
  let endDate = moment().format('YYYY-MM-DD')

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statAccountProfit(currentUser, type, startDate, endDate)
}

/**
 * 获取服务点投资人在过去一年所有服务点的投资收益
 * @param request
 * @returns {Array}
 */
async function reqStatLast1YearAccountProfit(request) {
  let currentUser = request.currentUser
  let type = request.params.accountType

  let startDate = moment().subtract(1, 'years').format('YYYY-MM-DD')
  let endDate = moment().format('YYYY-MM-DD')

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statAccountProfit(currentUser, type, startDate, endDate)
}

async function recordAccountError(dayInfo, errorInfo) {
  let ErrorInfo = AV.Object.extend('AccountErrLog')
  let errorLogInfo = new ErrorInfo()
  errorLogInfo.set('accountDay', new Date(dayInfo.yesterday))
  errorLogInfo.set('errorType', ERR_LOG_TYPE.UNTREAT)
  errorLogInfo.set('errorInfo', errorInfo)
  await errorLogInfo.save()
  return true
}

/**
 *
 * @param types array
 * @param lastCreatedAt
 * @returns {*}
 */
async function getUsersByRoles(roles, lastCreatedAt) {
  if (!roles) {
    return undefined
  }
  let query = new AV.Query('_User')
  query.containsAll('roles', roles)
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.equalTo('type', 3)
  try {
    let userList = await query.find()
    let users = []
    userList.forEach((item)=> {
      console.log('item111111',item.id)
      users.push(AuthFuncs.constructUserInfo(item))
    })
    return users
  } catch (err) {
    throw err
  }
}


async function accountTestFunc(req) {
  let dayInfo = getYesterday()
  let {params} = req
  let {types, lastCreatedAt} = params
  console.log('params===>', params)
  return await getUsersByRoles(types, lastCreatedAt)

}

var accountFunc = {
  getYesterday: getYesterday,
  createStationDayAccount: createStationDayAccount,
  getLastMonth: getLastMonth,
  getStationAccounts: getStationAccounts,
  getPartnerAccounts: getPartnerAccounts,
  getInvestorAccounts: getInvestorAccounts,
  getStationAccountsDetail: getStationAccountsDetail,
  getPartnerAccountsDetail: getPartnerAccountsDetail,
  getInvestorAccountsDetail: getInvestorAccountsDetail,
  getDayAccountsSum: getDayAccountsSum,
  accountTestFunc: accountTestFunc,
  reqStatAccountProfit,
  reqStatLast30DaysAccountProfit,
  reqStatLast3MonthsAccountProfit,
  reqStatLastHalfYearAccountProfit,
  reqStatLast1YearAccountProfit,
}

module.exports = accountFunc