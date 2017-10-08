/**
 * Created by lilu on 2017/9/28.
 */
var AV = require('leanengine');
var mysqlUtil = require('../Util/mysqlUtil')
var PingppFunc = require('../Pingpp')
var mpMsgFuncs = require('../../mpFuncs/Message')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')
var mathjs = require('mathjs')
var dateFormat = require('dateformat')

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

//查询该服务点下的1000个订单收益的和
function selectAmountSumByStation(stationId, lastTime) {
  let query = new AV.Query('Order')
  var station = AV.Object.createWithoutData('Station', stationId)
  console.log('stationId=====>',stationId)
  query.include('device.station')
  // query.equalTo('device.station', station)
  query.limit(1)
  let queryNum = 0
  let amountSum = 0
  let retLastTime = lastTime
  query.descending('createdAt')
  if (lastTime) {
    query.lessThan('createdAt', new Date(lastTime))
  }
  return query.find().then((orders)=> {
    // console.log('orders=====>',orders)
    if(orders&&orders.length){
      queryNum = orders.length
      orders.forEach((order)=> {
        retLastTime = order.createdAt
        console.log('order.attributes.device.attributes.station.id=====>',order.attributes.device.attributes.station.id)
        // console.log('order.attributes.amount=====>',order.attributes.amount)
        amountSum = mathjs.chain(amountSum).add(order.attributes.amount).done()
      })
    }
    console.log('amountSum=====>',amountSum)
    return {
      success: true,
      queryNum: queryNum,
      amountSum: amountSum,
      lastTime: retLastTime
    }
  },(err)=>{
    return {success: false, error: err}
  })
}

//查询单个服务点当天收益并生成日结数据插入Account表中
async function createStationAccount(stationId) {
  let lastTime = undefined
  let amountSum = 0
  let cost = 0
  while (1) {
    let result = await selectAmountSumByStation(stationId,lastTime)
    if (result.queryNum <= 0) {
      break
    }
    if (result.success) {
      console.log('result===>',result)
      lastTime = result.lastTime
      // cost = mathjs.chain(cost).add(result.cost).done()
      amountSum = mathjs.chain(amountSum).add(result.amountSum).done()
    }
  }
  // console.log('amountSum===>', amountSum)
  let station = AV.Object.createWithoutData('Station', stationId)
  let Account = AV.Object.extend('StationAccount')
  let account = new Account()
  account.set('incoming', amountSum)
  account.set('station', station)
  account.set('cost', cost)
  // account.set('profit', mathjs.chain(amountSum).sub(cost))
  account.save()
}

//查询limit数据量的服务点并生成日结数据
function selectStationsForAccount(lastTime) {
  let query = new AV.Query('Station')
  query.limit(1000)
  let queryNum = 0
  let retLastTime = lastTime
  query.descending('createdAt')
  if (lastTime) {
    query.lessThan('createdAt', new Date(lastTime))
  }
  console.log('stationqueryNum====>',queryNum)

  return query.find().then((stations)=> {
    if(stations&&stations.length){
      queryNum = stations.length
      stations.forEach((station)=> {
        retLastTime = station.createdAt
        createStationAccount(station.id)
      })
    }
    return {
      success: true,
      queryNum: queryNum,
      lastTime: retLastTime
    }
  }, (err)=> {
    return {success: false, error: err}
  })
}

//生成服务点日结数据
async function createStationDayAccount() {
  let lastTime = undefined
  while (1) {
    let result = await selectStationsForAccount( lastTime)
    console.log('result====>',result)
    if (result.queryNum <= 0) {
      break
    }
    if (result.success) {
      lastTime = result.lastTime
    }
  }
}

var orderFunc = {
  getYesterday: getYesterday,
  selectDealData: selectDealData,
  createStationDayAccount: createStationDayAccount,


}

module.exports = orderFunc