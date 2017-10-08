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
  var today = new Date();
  today.setHours(0);
  today.setMinutes(0);
  today.setSeconds(0);
  today.setMilliseconds(0);
  var oneday = 1000 * 60 * 60 * 24;
// 昨天
  var yesterday = new Date(today - oneday);
// 上周一

// 上个月1号
  response.success({today: today, yesterday: yesterday})
}

//查询该设备下的1000个订单收益的和
async function selectAmountSumBydeviceId(deviceId) {
  try {
    let amountSum = 0
    let orderList = await OrderFunc.getOrders(deviceId)
    orderList.forEach((order)=> {
      amountSum = mathjs.chain(amountSum).add(order.amount).done()
    })
    return amountSum
  } catch (error) {
    throw error
  }
}

//查询单个服务点当天收益并生成日结数据插入Account表中
async function createStationAccount(stationId) {
  try {
    let amountSum = 0
    let cost = 0
    let deviceList = await DeviceFuncs.getDevices(stationId)
    for (let i = 0; i < deviceList.length; i++) {
      let result = await selectAmountSumBydeviceId(deviceList[i].id)
      amountSum = mathjs.chain(amountSum).add(result).done()
    }

    console.log('amountSum===>', amountSum)
    let station = AV.Object.createWithoutData('Station', stationId)
    let Account = AV.Object.extend('StationAccount')
    let account = new Account()
    account.set('incoming', amountSum)
    account.set('station', station)
    account.set('cost', cost)
    // account.set('profit', mathjs.chain(amountSum).sub(cost))
    account.save()
  } catch (error) {
    throw error
  }

}

//生成服务点日结数据
async function createStationDayAccount() {
  try {
    let stationList = await StationFuncs.getStations()
    stationList.forEach((station)=> {
      createStationAccount(station.id)
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