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

function selectDealData(request,response) {

    var sql = ""
    var mysqlConn = undefined
    var records = []
    var startDate = '2017-09-05 00:00:00'
    var endDate = dateFormat('2017-09-09 00:00:00' )
  console.log('startDate====>',startDate)
     mysqlUtil.getConnection().then((conn) => {
      mysqlConn = conn
        sql = "SELECT * FROM `DealRecords` WHERE `deal_time`<? AND `deal_type`=1 ORDER BY `deal_time` "
        mysqlUtil.query(conn, sql, [ startDate ]).then((queryRes) => {
          // console.log('queryRes',queryRes)
          if(queryRes.results.length > 0) {
            queryRes.results.forEach((deal) => {
              var record = {
                order_no: deal.order_no,
                from: deal.from,
                to: deal.to,
                cost: deal.cost,
                dealTime: deal.deal_time,
                dealType: deal.deal_type,
              }
              records.push(record)
            })
          }
          console.log('records====>',records)
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

var orderFunc = {
  selectDealData: selectDealData,


}

module.exports = orderFunc