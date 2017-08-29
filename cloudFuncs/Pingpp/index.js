/**
 * Created by wanpeng on 2017/8/28.
 */
var GLOBAL_CONFIG = require('../../config')
var pingpp = require('pingpp')(GLOBAL_CONFIG.PINGPP_API_KEY)
var mysqlUtil = require('../util/mysqlUtil')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')

/**
 * 在mysql中插入支付记录
 * @param charge
 * @returns {Promise.<T>}
 */
function insertChargeInMysql(charge) {
  var created = new Date(charge.created * 1000).toISOString().slice(0, 19).replace('T', ' ')
  var sql = ""
  var mysqlConn = undefined
  return mysqlUtil.getConnection().then((conn) => {
    mysqlConn = conn
    sql = "SELECT count(1) as cnt FROM `PaymentCharge` WHERE `order_no` = ? LIMIT 1"
    return mysqlUtil.query(conn, sql, [charge.order_no])
  }).then((queryRes) => {
    if (queryRes.results[0].cnt == 0) {
      sql = "INSERT INTO `PaymentCharge` (`order_no`, `channel`, `created`, `amount`, `currency`, `transaction_no`, `subject`, `user`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      return mysqlUtil.query(queryRes.conn, sql, [charge.order_no, charge.channel, created, charge.amount, charge.currency, charge.transaction_no, charge.subject, charge.metadata.user])
    } else {
      return new Promise((resolve) => {
        resolve()
      })
    }
  }).catch((err) => {
    throw err
  }).finally(() => {
    if (mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  })
}

function createPayment(request, response) {
  var order_no = uuidv4().replace(/-/g, '').substr(0, 16)
  var amount = parseInt(request.params.amount * 100).toFixed(0) //人民币分
  var channel = request.params.channel
  var metadata = request.params.metadata
  var openid = request.params.openid
  var subject = request.params.subject


  pingpp.setPrivateKeyPath(__dirname + "/rsa_private_key.pem");

  pingpp.charges.create({
    order_no: order_no,// 推荐使用 8-20 位，要求数字或字母，不允许其他字符
    app: {id: GLOBAL_CONFIG.PINGPP_APP_ID},
    channel: channel,// 支付使用的第三方支付渠道取值，请参考：https://www.pingxx.com/api#api-c-new
    amount: amount,//订单总金额, 人民币单位：分（如订单总金额为 1 元，此处请填 100）
    client_ip: "127.0.0.1",// 发起支付请求客户端的 IP 地址，格式为 IPV4，如: 127.0.0.1
    currency: "cny",
    subject: subject,
    body: "商品的描述信息",
    extra: {
      open_id: openid
    },
    description: "衣家宝支付",
    metadata: metadata,
  }, function (err, charge) {
    if (err != null) {
      console.log("pingpp.charges.create fail:", err)
      response.error({
        errcode: 1,
        message: '[PingPP] create charges failed!',
      })
    }
    response.success(charge)
  })
}

function paymentEvent(request, response) {

}

function createTransfer(request, response) {

}

function transferEvent(request, response) {

}

var PingppFunc = {
  createPayment: createPayment,
  paymentEvent: paymentEvent,
  createTransfer: createTransfer,
  transferEvent: transferEvent,
}

module.exports = PingppFunc