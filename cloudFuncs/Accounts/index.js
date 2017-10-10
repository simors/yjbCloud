/**
 * Created by lilu on 2017/9/28.
 */
var AV = require('leanengine');
var mysqlUtil = require('../Util/mysqlUtil')
var OrderFunc = require('../Order')
var DeviceFuncs = require('../Device')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')
var mathjs = require('mathjs')
var dateFormat = require('dateformat')
var StationFuncs = require('../Station')

//服务点日结
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
  accountInfo.platfomProfit = account.attributes.platfomProfit
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

function selectDealData(request, response) {
  var sql = ""
  var mysqlConn = undefined
  var records = []
  var startDate = '2017-09-05 00:00:00'
  var endDate = dateFormat('2017-09-09 00:00:00')
  console.log('startDate====>', startDate)
  mysqlUtil.getConnection().then((conn) => {
    mysqlConn = conn
    sql = "SELECT sum(cost) as costSum FROM `DealRecords` WHERE `deal_time`<? AND `deal_type`=1 ORDER BY `deal_time` "
    mysqlUtil.query(conn, sql, [startDate]).then((queryRes) => {
      // console.log('queryRes',queryRes)
      if (queryRes.results.length > 0) {
        queryRes.results.forEach((deal) => {
          var record = {
            // order_no: deal.order_no,
            // from: deal.from,
            // to: deal.to,
            // cost: deal.cost,
            // dealTime: deal.deal_time,
            // dealType: deal.deal_type,
            costSum: deal.costSum
          }
          records.push(record)
        })
      }
      console.log('records====>', records)
      response.success(records)
    }).catch((error) => {
      console.log('getUserDealRecords', error)
      throw error
    }).finally(() => {
      if (mysqlConn) {
        mysqlUtil.release(mysqlConn)
      }
    })
  })
}

//查询昨天日期
function getYesterday(request, response) {
  var today = new Date().toLocaleDateString();
  today = new Date(today)
  console.log('today========>',today)
  // today.setHours(0);
  // today.setMinutes(0);
  // today.setSeconds(0);
  // today.setMilliseconds(0);
  console.log('today========>',today)
  var oneday = 1000 * 60 * 60 * 24;
// 昨天
  var yesterday = new Date(today - oneday);
// 上周一
  console.log('today=====>',today)
  console.log('yesterday=====>',yesterday)

  return {today: today, yesterday: yesterday}
// 上个月1号
//   response.success({today: today, yesterday: yesterday})
}

//查询该设备下的1000个订单收益的和
async function selectAmountSumBydeviceId(deviceId,dayInfo) {
  try {
    let amountSum = 0
    let orderList = await OrderFunc.getOrders(deviceId)
    // let dayInfo = getYesterday()
    orderList.forEach((order)=> {
      // console.log('order.payTime====>',order.payTime,dayInfo)

      if (order.payTime && (new Date(order.payTime) < new Date(dayInfo.today)) && (new Date(order.payTime) >= new Date(dayInfo.yesterday)) && order.status == 2 ) {
        // console.log('order.amount====>',order.amount)
      if(order.amount){
        amountSum = mathjs.chain(amountSum).add(order.amount).done()
      }
      }
    })
    return amountSum
  } catch (error) {
    throw error
  }
}

//查询单个服务点当天收益并生成日结数据插入Account表中
async function createStationAccount(stationId,dayInfo) {
  try {
    let amountSum = 0
    let cost = 0
    let deviceList = await DeviceFuncs.getDevices(stationId)
    for (let i = 0; i < deviceList.length; i++) {
      let result = await selectAmountSumBydeviceId(deviceList[i].id,dayInfo)
      amountSum = mathjs.round(mathjs.chain(amountSum).add(result).done(),2)
    }
    // console.log('amountSum===>', amountSum)
    let station = AV.Object.createWithoutData('Station', stationId)
    let Account = AV.Object.extend('StationAccount')
    let account = new Account()
    let profit = mathjs.round(mathjs.chain(amountSum).subtract(cost).done(),2)
    account.set('incoming', amountSum)
    account.set('station', station)
    account.set('accountDay', dayInfo.yesterday)
    account.set('cost', cost)
    account.set('profit', profit)
    let accountInfo = await account.save()
    let isSuccess = await createPartnerAccount(accountInfo.id,dayInfo)

    return accountInfo
  } catch (error) {
    throw error
  }
}

//根据服务点日结数据生成分成方和投资人日结数据
async function createPartnerAccount(accountId,dayInfo) {
  try {
    let queryAccount = new AV.Query('StationAccount')
    queryAccount.include(['station'])
    let partnerProfit = 0
    let investorProfit = 0
    // let dayInfo = getYesterday()
    let stationAccount = await queryAccount.get(accountId)
    let stationAccountInfo = constructStationAccountnInfo(stationAccount, true)
    // console.log('hahahahahahahah here is true',stationAccountInfo.profit,stationAccountInfo.station.platformProp)
    let platfomProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).multiply(stationAccountInfo.station.platformProp).done(),2)
    // console.log('stationAccountInfo=====>',stationAccountInfo.stationId)
    let station = AV.Object.createWithoutData('Station', stationAccountInfo.stationId)
    let stationAccountObject = AV.Object.createWithoutData('StationAccount', accountId)
    let partnerList = await StationFuncs.getPartnerByStationId(stationAccountInfo.stationId)
    if (partnerList && partnerList.length > 0) {
      // console.log('partnerList====>',partnerList)
      for (let i = 0; i < partnerList.length; i++) {
        let partner = partnerList[i]
        let profitSharing = AV.Object.createWithoutData('ProfitSharing', partner.id)
        let PartnerAccount = AV.Object.extend('PartnerAccount')
        let partnerAccount = new PartnerAccount()
        partnerAccount.set('stationAccount', stationAccountObject)
        let profit = mathjs.round(mathjs.chain(stationAccountInfo.profit).multiply(partner.royalty).done(),2)
        partnerAccount.set('profit', profit)
        partnerAccount.set('accountDay', dayInfo.yesterday)
        partnerAccount.set('profitSharing', profitSharing)
        partnerAccount.set('station', station)
        await partnerAccount.save()
        partnerProfit = mathjs.round(mathjs.chain(partnerProfit).add(profit).done(),2)
      }
    }
    let investorList = await StationFuncs.getInvestorByStationId(stationAccountInfo.stationId)
    investorProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).subtract(platfomProfit).subtract(partnerProfit).done(),2)
    if (investorList && investorList.length > 0) {
      // console.log('investorList====>',investorList)

      for (let i = 0; i < investorList.length; i++) {
        let investor = investorList[i]
        let profitSharing = AV.Object.createWithoutData('ProfitSharing', investor.id)
        let InvestorAccount = AV.Object.extend('InvestorAccount')
        let investorAccount = new InvestorAccount()
        investorAccount.set('stationAccount', stationAccountObject)
        let profit = mathjs.round(mathjs.chain(investorProfit).multiply(investor.royalty).done(),2)
        investorAccount.set('profit', profit)
        investorAccount.set('accountDay', dayInfo.yesterday)
        investorAccount.set('profitSharing', profitSharing)
        investorAccount.set('station', station)
        await investorAccount.save()
      }
    } else {
      investorProfit = 0
      platfomProfit = mathjs.round(mathjs.chain(stationAccountInfo.profit).subtract(partnerProfit).done(),2)
    }
    stationAccountObject.set('investorProfit',investorProfit)
    stationAccountObject.set('partnerProfit',partnerProfit)
    stationAccountObject.set('platfomProfit',platfomProfit)
    await stationAccountObject.save()
    return {success: true}
  } catch (err) {
    throw err
  }

}

//生成服务点日结数据
async function createStationDayAccount() {
  try {
    let stationList = await StationFuncs.getStations()
    let dayInfo = getYesterday()
    stationList.forEach((station)=> {
      createStationAccount(station.id,dayInfo)
    })
  } catch (error) {
    throw error
  }
}

var orderFunc = {
  getYesterday: getYesterday,
  selectDealData: selectDealData,
  createStationDayAccount: createStationDayAccount,


}

module.exports = orderFunc