/**
 * Created by lilu on 2017/9/28.
 */
var mysqlUtil = require('../Util/mysqlUtil')
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

//分成方以及投资人日结数据构造方法
function constructSharingAccountnInfo(account, includeStation, includeUser) {
  if (!account) {
    return undefined
  }
  let constructStationInfo = StationFuncs.constructStationInfo
  let constructUserInfo = require('../Auth').constructUserInfo
  let accountInfo = {}

  let station = account.attributes.station
  let user = account.attributes.user
  accountInfo.id = account.id
  accountInfo.accountDay = account.attributes.accountDay
  accountInfo.profit = account.attributes.profit
  accountInfo.stationId = station ? station.id : undefined
  accountInfo.userId = user ? user.id : undefined
  if (includeStation && station) {
    accountInfo.station = constructStationInfo(station)
  }
  if (includeUser && user) {
    accountInfo.user = constructUserInfo(user)
  }
  accountInfo.createdAt = account.createdAt
  return accountInfo
}

function constructInvestorAccount(lcInvestorAccount, includeStation, includeUser, includeStationAccount, includeProfitSharing) {
  if (!lcInvestorAccount) {
    return undefined
  }

  let constructStationInfo = StationFuncs.constructStationInfo
  let constructProfitSharing = StationFuncs.constructProfitSharing
  let constructUserInfo = require('../Auth').constructUserInfo
  let investorAccount = {}

  let accountAttr = lcInvestorAccount.attributes
  if (!accountAttr) {
    return undefined
  }
  investorAccount.id = lcInvestorAccount.id
  investorAccount.userId = accountAttr.user ? accountAttr.user.id : undefined
  investorAccount.stationId = accountAttr.station ? accountAttr.station.id : undefined
  investorAccount.stationAccountId = accountAttr.stationAccount ? accountAttr.stationAccount.id : undefined
  investorAccount.profitSharingId = accountAttr.profitSharing ? accountAttr.profitSharing.id : undefined
  investorAccount.profit = accountAttr.profit
  investorAccount.accountDay = accountAttr.accountDay
  investorAccount.createdAt = lcInvestorAccount.createdAt
  investorAccount.updatedAt = lcInvestorAccount.updatedAt

  if (includeStation) {
    investorAccount.station = constructStationInfo(accountAttr.station, false)
  }

  if (includeStationAccount) {
    investorAccount.stationAccount = constructStationAccountnInfo(accountAttr.stationAccount, false)
  }

  if (includeProfitSharing) {
    investorAccount.profitSharing = constructProfitSharing(accountAttr.profitSharing, false)
  }

  if (includeUser) {
    investorAccount.user = constructUserInfo(accountAttr.user)
  }

  return investorAccount
}

//
// function selectDealData(request, response) {
//   var sql = ""
//   var mysqlConn = undefined
//   var records = []
//   var startDate = '2017-09-05 00:00:00'
//   var endDate = dateFormat('2017-09-09 00:00:00')
//   console.log('startDate====>', startDate)
//   mysqlUtil.getConnection().then((conn) => {
//     mysqlConn = conn
//     sql = "SELECT sum(cost) as costSum FROM `DealRecords` WHERE `deal_time`<? AND `deal_type`=1 ORDER BY `deal_time` "
//     mysqlUtil.query(conn, sql, [startDate]).then((queryRes) => {
//       // console.log('queryRes',queryRes)
//       if (queryRes.results.length > 0) {
//         queryRes.results.forEach((deal) => {
//           var record = {
//             // order_no: deal.order_no,
//             // from: deal.from,
//             // to: deal.to,
//             // cost: deal.cost,
//             // dealTime: deal.deal_time,
//             // dealType: deal.deal_type,
//             costSum: deal.costSum
//           }
//           records.push(record)
//         })
//       }
//       console.log('records====>', records)
//       response.success(records)
//     }).catch((error) => {
//       console.log('getUserDealRecords', error)
//       throw error
//     }).finally(() => {
//       if (mysqlConn) {
//         mysqlUtil.release(mysqlConn)
//       }
//     })
//   })
// }

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
    // console.log('device=====>',device)
    // console.log('standbyPowerSum=====>',standbyPowerSum)
    let useTime = 0
    let orderList = await OrderFunc.getOrders(device.id,dayInfo.yesterday,dayInfo.today)
    // let dayInfo = getYesterday()
    if(orderList&&orderList.length>0){
      orderList.forEach((order)=> {
        // console.log('order.payTime====>',order.payTime,dayInfo)
         // console.log('order.amount====>',order.amount)
          if (order.amount) {
            let endTime = new Date(order.endTime)
            // console.log('endTime======>',endTime)
            //
            let startTime = new Date(order.createTime)
            // console.log('startTime======>',startTime)
            // let lastTimeD = endTime - startTime

            let lastTime = mathjs.round(mathjs.chain(endTime - startTime).multiply(1/3600000).done(), 3)
            // console.log('lastTime======>',lastTime)
            useTime = mathjs.chain(useTime).add(lastTime).done()
            // console.log('useTime======>',useTime)
            amountSum = mathjs.chain(amountSum).add(order.amount).done()
            console.log('amountSum======>',amountSum)
          }

      })
    }
    usePowerSum = mathjs.chain(useTime).multiply(device.usePower).done()
    let standbyPowerSum = mathjs.round(mathjs.chain(device.standbyPower).multiply(24-useTime).done(), 2)
    powerSum = mathjs.chain(usePowerSum).add(standbyPowerSum).done()
    return {amountSum: amountSum, powerSum: powerSum}
  } catch (error) {
    throw error
  }
}

//查询单个服务点当天收益并生成日结数据插入Account表中
async function createStationAccount(station, dayInfo) {
  // console.log('station======>', station)
  let amountSum = 0
  let cost = 0
  let powerSum = 0
  let profit = 0
  // let station = station
  try {
    let deviceList = await DeviceFuncs.getDevices(station.id)
    for (let i = 0; i < deviceList.length; i++) {
      let result = await selectAmountSumBydeviceId(deviceList[i], dayInfo)
      amountSum = mathjs.round(mathjs.chain(amountSum).add(result.amountSum).done(), 2)
      powerSum = mathjs.round(mathjs.chain(powerSum).add(result.powerSum).done(), 2)
    }
    // console.log('amountSum===>', amountSum)
    let stationInfo = AV.Object.createWithoutData('Station', station.id)
    let Account = AV.Object.extend('StationAccount')
    let account = new Account()
    cost = mathjs.round(mathjs.chain(station.powerUnitPrice).multiply(powerSum).done(), 2)
    profit = mathjs.round(mathjs.chain(amountSum).subtract(cost).done(), 2)
    account.set('incoming', amountSum)
    account.set('station', stationInfo)
    account.set('accountDay', dayInfo.yesterday)
    account.set('cost', cost)
    account.set('profit', profit)
    let accountInfo = await account.save()
    let query = new AV.Query('StationAccount')

    let newStationAccount = await createPartnerAccount(accountInfo.id, dayInfo)
    // console.log('newStation=====>',newStation)
    return newStationAccount
  } catch (error) {
    throw error
  }
}

//根据服务点日结数据生成分成方和投资人日结数据
async function createPartnerAccount(accountId, dayInfo) {
  try {
    let queryAccount = new AV.Query('StationAccount')
    queryAccount.include(['station'])
    let partnerProfit = 0
    let investorProfit = 0
    // let dayInfo = getYesterday()
    let stationAccount = await queryAccount.get(accountId)
    let stationAccountInfo = constructStationAccountnInfo(stationAccount, true)
    // console.log('hahahahahahahah here is true',stationAccountInfo.profit,stationAccountInfo.station.platformProp)
    let platfomProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).multiply(stationAccountInfo.station.platformProp).done(), 2)
    // console.log('stationAccountInfo=====>',stationAccountInfo.stationId)
    let station = AV.Object.createWithoutData('Station', stationAccountInfo.stationId)
    let stationAccountObject = AV.Object.createWithoutData('StationAccount', accountId)
    let partnerList = await StationFuncs.getPartnerByStationId(stationAccountInfo.stationId)
    if (partnerList && partnerList.length > 0) {
      // console.log('partnerList====>',partnerList)
      for (let i = 0; i < partnerList.length; i++) {
        let partner = partnerList[i]
        let user = AV.Object.createWithoutData('_User', partner.shareholderId)
        let profitSharing = AV.Object.createWithoutData('ProfitSharing', partner.id)
        let PartnerAccount = AV.Object.extend('PartnerAccount')
        let partnerAccount = new PartnerAccount()
        partnerAccount.set('stationAccount', stationAccountObject)
        let profit = mathjs.round(mathjs.chain(stationAccountInfo.profit).multiply(partner.royalty).done(), 2)
        partnerAccount.set('profit', profit)
        partnerAccount.set('accountDay', dayInfo.yesterday)
        partnerAccount.set('profitSharing', profitSharing)
        partnerAccount.set('station', station)
        partnerAccount.set('user', user)

        await partnerAccount.save()
        partnerProfit = mathjs.round(mathjs.chain(partnerProfit).add(profit).done(), 2)
      }
    }
    let investorList = await StationFuncs.getInvestorByStationId(stationAccountInfo.stationId)
    investorProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).subtract(platfomProfit).subtract(partnerProfit).done(), 2)
    if (investorList && investorList.length > 0) {
      // console.log('investorList====>',investorList)
      for (let i = 0; i < investorList.length; i++) {
        let investor = investorList[i]
        let user = AV.Object.createWithoutData('_User', investor.shareholderId)
        let profitSharing = AV.Object.createWithoutData('ProfitSharing', investor.id)
        let InvestorAccount = AV.Object.extend('InvestorAccount')
        let investorAccount = new InvestorAccount()
        investorAccount.set('stationAccount', stationAccountObject)
        let profit = mathjs.round(mathjs.chain(investorProfit).multiply(investor.royalty).done(), 2)
        investorAccount.set('profit', profit)
        investorAccount.set('accountDay', dayInfo.yesterday)
        investorAccount.set('profitSharing', profitSharing)
        investorAccount.set('station', station)
        investorAccount.set('user', user)
        await investorAccount.save()
      }
    } else {
      investorProfit = 0
      platfomProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).subtract(partnerProfit).done(), 2)
    }
    stationAccountObject.set('investorProfit', investorProfit)
    stationAccountObject.set('partnerProfit', partnerProfit)
    stationAccountObject.set('platformProfit', platfomProfit)
    let stationInfo = await stationAccountObject.save(null,{fetchWhenSave: true})
    return stationInfo
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

  try {
    let stationList = await StationFuncs.getStations()
    let dayInfo = getYesterday()
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
  } catch (error) {
    throw error
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
  // if(startDate){
  //   query.greaterThanOrEqualTo('accountDay',new Date(startDate))
  // }
  // if(endDate){
  //   query.lessThanOrEqualTo('accountDay',new Date(endDate))
  // }
  // query.include(['station','station.admin'])
  try {
    let stations = await query.find()
    let accountList = []
    // console.log('station.length====>',stations.length)
    for (let i = 0; i < stations.length; i++) {
      let account = await getAccountByStationId(stations[i].id, startDate, endDate)
      // console.log('account=========>',account)
      if (account && account.stationId) {
        accountList.push(account)
      }
    }
    // stations.forEach((station)=>{
    // })
    response.success({accountList: accountList})
  } catch (error) {
    throw error
  }
}

//查询每个服务点的收益结算
async function getAccountByStationId(stationId, startDate, endDate) {
  let query = new AV.Query('StationAccount')
  let lastCreatedAt = undefined
  let incoming = 0
  let profit = 0
  let cost = 0
  let platformProfit = 0
  let partnerProfit = 0
  let investorProfit = 0

  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (startDate) {
    // console.log('startDate+=======>',new Date(new Date(startDate)-1000))
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    // console.log('startDate+=======>',new Date(endDate))

    query.lessThan('accountDay', new Date(endDate))
  }
  query.include(['station', 'station.admin'])
  query.limit(1000)
  query.descending('createdAt')
  let accountInfo = {}
  try {
    while (1) {
      if (lastCreatedAt) {
        // console.log('lastCreatedAt======>',new Date(lastCreatedAt))
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let accounts = await query.find()
      console.log('accounts.length=====>', accounts.length, stationId)
      if (accounts.length < 1) {
        break
      }
      accounts.forEach((account) => {
        // console.log('account.attributes.========>', account.attributes)
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
      return accountInfo
    } else {
      return accountInfo
    }
    // console.log('accountInfo=======>',accountInfo)
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
  let query = new AV.Query('_User')
  if (userId) {
    query.equalTo('objectId', userId)
  }
  // if(startDate){
  //   query.greaterThanOrEqualTo('accountDay',new Date(startDate))
  // }
  // if(endDate){
  //   query.lessThanOrEqualTo('accountDay',new Date(endDate))
  // }
  // query.include(['station','station.admin'])
  try {
    let partners = await query.find()
    let accountList = []
    // console.log('station.length====>',stations.length)
    for (let i = 0; i < partners.length; i++) {
      let account = await getAccountsByPartnerId(partners[i].id, stationId, startDate, endDate)
      // console.log('account=========>',account)
      if (account && account.stationId) {
        accountList.push(account)
      }
    }
    // stations.forEach((station)=>{
    // })
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
  let query = new AV.Query('PartnerAccount')
  let lastCreatedAt = undefined
  let profit = 0

  if (partnerId) {
    let partner = AV.Object.createWithoutData('_User', partnerId)
    query.equalTo('user', partner)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (startDate) {
    // console.log('startDate+=======>',new Date(new Date(startDate)-1000))
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    // console.log('startDate+=======>',new Date(endDate))

    query.lessThan('accountDay', new Date(endDate))
  }
  query.include(['station', 'station.admin', 'user'])
  query.limit(1000)
  query.descending('createdAt')
  let accountInfo = {}
  try {
    while (1) {
      if (lastCreatedAt) {
        // console.log('lastCreatedAt======>',new Date(lastCreatedAt))
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let accounts = await query.find()
      if (accounts.length < 1) {
        break
      }
      accounts.forEach((account) => {
        // console.log('account.attributes.========>', account.attributes)
        if (account) {
          profit = mathjs.round(mathjs.chain(profit).add(account.attributes.profit).done(), 2)
          accountInfo = constructSharingAccountnInfo(account, true, true)
        }
      })
      lastCreatedAt = accounts[accounts.length - 1].createdAt.valueOf()
    }
    if (accountInfo && accountInfo.stationId) {
      accountInfo.profit = profit
      return accountInfo
    } else {
      return accountInfo
    }
    // console.log('accountInfo=======>',accountInfo)
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
  let query = new AV.Query('_User')
  if (userId) {
    query.equalTo('objectId', userId)
  }
  // if(startDate){
  //   query.greaterThanOrEqualTo('accountDay',new Date(startDate))
  // }
  // if(endDate){
  //   query.lessThanOrEqualTo('accountDay',new Date(endDate))
  // }
  // query.include(['station','station.admin'])
  try {
    let partners = await query.find()
    let accountList = []
    // console.log('station.length====>',stations.length)
    for (let i = 0; i < partners.length; i++) {
      let account = await getAccountsByInvestorId(partners[i].id, stationId, startDate, endDate)
      // console.log('account=========>',account)
      if (account && account.stationId) {
        accountList.push(account)
      }
    }
    // stations.forEach((station)=>{
    // })
    response.success({accountList: accountList})
  } catch (error) {
    throw error
  }
}

/**
 * 获取单个分成方的结算统计
 * @param {}
 */
async function getAccountsByInvestorId(investorId, stationId, startDate, endDate) {
  let query = new AV.Query('InvestorAccount')
  let lastCreatedAt = undefined
  let profit = 0

  if (investorId) {
    let investor = AV.Object.createWithoutData('_User', investorId)
    query.equalTo('user', investor)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (startDate) {
    // console.log('startDate+=======>',new Date(new Date(startDate)-1000))
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    // console.log('startDate+=======>',new Date(endDate))

    query.lessThan('accountDay', new Date(endDate))
  }
  query.include(['station', 'station.admin', 'user'])
  query.limit(1000)
  query.descending('createdAt')
  let accountInfo = {}
  try {
    while (1) {
      if (lastCreatedAt) {
        // console.log('lastCreatedAt======>',new Date(lastCreatedAt))
        query.lessThan('createdAt', new Date(lastCreatedAt))
      }
      let accounts = await query.find()
      if (accounts.length < 1) {
        break
      }
      accounts.forEach((account) => {
        // console.log('account.attributes.========>', account.attributes)
        if (account) {
          profit = mathjs.round(mathjs.chain(profit).add(account.attributes.profit).done(), 2)
          accountInfo = constructSharingAccountnInfo(account, true, true)
        }
      })
      lastCreatedAt = accounts[accounts.length - 1].createdAt.valueOf()
    }
    if (accountInfo && accountInfo.stationId) {
      accountInfo.profit = profit
      return accountInfo
    } else {
      return accountInfo
    }
    // console.log('accountInfo=======>',accountInfo)
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
  let query = new AV.Query('StationAccount')
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (startDate) {
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    query.lessThan('accountDay', new Date(endDate))
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
      accountList.push(constructStationAccountnInfo(account, true))
    })
    console.log('accountList.length======>', accountList.length)
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
  let query = new AV.Query('PartnerAccount')
  if (userId) {
    let user = AV.Object.createWithoutData('_User', userId)
    query.equalTo('user', user)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (startDate) {
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    query.lessThan('accountDay', new Date(endDate))
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.descending('createdAt')
  query.include(['station', 'user'])
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((account)=> {
      accountList.push(constructSharingAccountnInfo(account, true, true))
    })
    console.log('accountList.length======>', accountList.length)
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
  let query = new AV.Query('InvestorAccount')
  if (userId) {
    let user = AV.Object.createWithoutData('_User', userId)
    query.equalTo('user', user)
  }
  if (stationId) {
    let station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  if (startDate) {
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    query.lessThan('accountDay', new Date(endDate))
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.descending('createdAt')
  query.include(['station', 'user'])
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((account)=> {
      accountList.push(constructSharingAccountnInfo(account, true, true))
    })
    console.log('accountList.length======>', accountList.length)
    response.success(accountList)
  } catch (error) {
    response.error(error)
  }
}

//测试mathjs（
// function testMathjs(request, response) {
//   let high = new Date('2017/05/01 00:00:00')
//   // console.log('high====>',high)
//   let low = new Date()
//   let sum = mathjs.chain(low - high).add(123123123).done()
//   let lll = mathjs.chain(1000).multiply(1 / 60).done()
//   response.success({high: high, low: low, sum: sum, lll: lll})
// }

/*
 * 获取总和日结信息
 * @ params {}
 */
async function getDayAccountsSum(request, response) {
  let startDate = request.params.startDate
  let endDate = request.params.endDate
  let limit = request.params.limit || 30
  let lastCreatedAt = request.params.lastCreatedAt
  let query = new AV.Query('DayAccountSum')

  if (startDate) {
    query.greaterThanOrEqualTo('accountDay', new Date(startDate))
  }
  if (endDate) {
    query.lessThan('accountDay', new Date(endDate))
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', new Date(lastCreatedAt))
  }
  query.limit(limit)
  query.descending('createdAt')
  try {
    let accounts = await query.find()
    let accountList = []
    accounts.forEach((item)=>[
      accountList.push(constructStationAccountnInfo(item))
    ])
    response.success(accountList)
  } catch (error) {
    response.error(error)
  }
}

async function statInvestorProfit(user, startDate, endDate) {
  let beginQuery = new AV.Query('InvestorAccount')
  beginQuery.greaterThanOrEqualTo('accountDay', new Date(startDate))

  let endQuery = new AV.Query('InvestorAccount')
  endQuery.lessThanOrEqualTo('accountDay', new Date(endDate))

  let query = AV.Query.and(beginQuery, endQuery)
  query.ascending('accountDay')
  query.equalTo('user', user)
  query.include('station')

  let result = await query.find()
  let investorProfits = []
  result.forEach((profit) => {
    investorProfits.push(constructInvestorAccount(profit, true, false, false, false))
  })
  return investorProfits
}

async function reqStatInvestorProfit(request) {
  let currentUser = request.currentUser
  let startDate = request.params.startDate
  let endDate = request.params.endDate

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statInvestorProfit(currentUser, startDate, endDate)
}

async function reqStatLast30DaysInvestorProfit(request) {
  let currentUser = request.currentUser

  let startDate = new Date(moment().subtract(30, 'days').format('YYYY-MM-DD'))
  let endDate = new Date(moment().format('YYYY-MM-DD'))

  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }

  return statInvestorProfit(currentUser, startDate, endDate)
}

var accountFunc = {
  getYesterday: getYesterday,
  // selectDealData: selectDealData,
  createStationDayAccount: createStationDayAccount,
  getLastMonth: getLastMonth,
  getStationAccounts: getStationAccounts,
  getPartnerAccounts: getPartnerAccounts,
  getInvestorAccounts: getInvestorAccounts,
  getStationAccountsDetail: getStationAccountsDetail,
  getPartnerAccountsDetail: getPartnerAccountsDetail,
  getInvestorAccountsDetail: getInvestorAccountsDetail,
  getDayAccountsSum: getDayAccountsSum,
  reqStatLast30DaysInvestorProfit,
  reqStatInvestorProfit,

  // testMathjs: testMathjs


}

module.exports = accountFunc