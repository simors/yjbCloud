/**
 * Created by wanpeng on 2017/8/28.
 */
var GLOBAL_CONFIG = require('../../config')
var pingpp = require('pingpp')(GLOBAL_CONFIG.PINGPP_API_KEY)
var mysqlUtil = require('../Util/mysqlUtil')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')

// 支付类型定义
const DEPOSIT = 1                // 押金
const RECHARGE = 2               // 充值
const SERVICE = 3                // 服务消费
const REFUND = 4                 // 押金退款
const WITHDRAW = 5               // 提现


/**
 * 在mysql中插入交易记录
 * @param conn
 * @param deal
 * @returns {Promise.<T>}
 */
function updateUserDealRecords(conn, deal) {
  if (!deal.from || !deal.to || !deal.cost || !deal.deal_type) {
    throw new Error('')
  }
  var charge_id = deal.charge_id || ''
  var order_no = deal.order_no || ''
  var channel = deal.channel || ''
  var transaction_no = deal.transaction_no || ''
  var feeAmount = deal.feeAmount || 0
  var recordSql = 'INSERT INTO `DealRecords` (`from`, `to`, `cost`, `deal_type`, `charge_id`, `order_no`, `channel`, `transaction_no`, `fee`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  return mysqlUtil.query(conn, recordSql, [deal.from, deal.to, deal.cost, deal.deal_type, charge_id, order_no, channel, transaction_no, feeAmount])
}

/**
 * 获取mysql中的Wallet信息
 * @param useId
 * @returns {Promise.<T>}
 */
function getWalletInfo(userId) {
  var sql = ""
  var mysqlConn = undefined
  var walletInfo = {}

  return mysqlUtil.getConnection().then((conn) => {
    mysqlConn = conn
    sql = "SELECT `userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt` FROM `Wallet` WHERE `userId` = ?"
    return mysqlUtil.query(conn, sql, [userId])
  }).then((queryRes) => {
    if(queryRes.results.length === 1) {
      console.log("queryRes.results[0]", queryRes.results[0])

      walletInfo.userId = queryRes.results[0].userId || userId
      walletInfo.balance = queryRes.results[0].balance || 0
      walletInfo.deposit = queryRes.results[0].deposit || 0
      walletInfo.openid = queryRes.results[0].openid || ""
      walletInfo.debt = queryRes.results[0].debt || 0
      walletInfo.user_name = queryRes.results[0].user_name || ""
      return walletInfo
    }
    return undefined
  }).catch((error) => {
    console.log('getWalletInfo', error)
    throw error
  }).finally(() => {
    if (mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  })
}

/**
 * 更新mysql中的Wallet信息
 * @param conn
 * @param deal
 * @returns {Promise.<T>}
 */
function updateWalletInfo(conn, deal) {
  if (!deal.from || !deal.cost || !deal.deal_type) {
    throw new Error('')
  }
  var userId = undefined

  switch (deal.deal_type) {
    case DEPOSIT:
    case RECHARGE:
    case SERVICE:
      userId = deal.from
      break
    case REFUND:
    case WITHDRAW:
      userId = deal.to
      break
    default:
      break
  }

  console.log("updateWalletInfo userId:", userId)
  var openid = deal.openid
  var user_name = deal.user_name || ''
  var balance = 0
  var deposit = 0
  var debt = 0
  var password = ''

  var sql = "SELECT count(1) as cnt FROM `Wallet` WHERE `userId` = ? LIMIT 1"
  return mysqlUtil.query(conn, sql, [userId]).then((queryRes) => {
    if (queryRes.results[0].cnt == 1) {
      var currentBalance = queryRes.results[0].balance
      var currentDebt = queryRes.results[0].debt

      switch (deal.deal_type) {
        case DEPOSIT:
          sql = "UPDATE `Wallet` SET `deposit` = ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case RECHARGE:
          if(debt === 0) {
            sql = "UPDATE `Wallet` SET `balance` = `balance` + ? WHERE `userId` = ?"
            return mysqlUtil.query(conn, sql, [deal.cost, userId])
          } else {
            sql = "UPDATE `Wallet` SET `balance` = `balance` + ?, `debt` = ? WHERE `userId` = ?"
            return mysqlUtil.query(conn, sql, [deal.cost - currentDebt, 0, userId])
          }
          break
        case WITHDRAW:
          sql = "UPDATE `Wallet` SET `balance` = `balance` - ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case SERVICE:
          if(currentBalance > deal.cost) {
            sql = "UPDATE `Wallet` SET `balance` = `balance` - ? WHERE `userId` = ?"
            return mysqlUtil.query(conn, sql, [deal.cost, userId])
          } else {
            debt = deal.cost - currentBalance
            sql = "UPDATE `Wallet` SET `balance` = ?, `debt` = ? WHERE `userId` = ?"
            return mysqlUtil.query(conn, sql, [deal.cost, debt, userId])
          }
          break
        case REFUND:
          sql = "UPDATE `Wallet` SET `deposit` = `deposit` - ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        default:
          return Promise.resolve()
          break
      }
    } else {
      switch (deal.deal_type) {
        case DEPOSIT:
          deposit = deal.cost
          break
        case RECHARGE:
          balance = deal.cost
          break
        case SERVICE:
          debt = deal.cost
          break
        case WITHDRAW:
        case REFUND:
        default:
          return Promise.resolve()
          break
      }
      sql = "INSERT INTO `Wallet` (`userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt`) VALUES (?, ?, ?, ?, ?, ?, ?)"
      return mysqlUtil.query(conn, sql, [userId, balance, deposit, password, openid, user_name, debt])
    }
  }).catch((error) => {
    console.log("updateWalletInfo", error)
    throw error
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
  var charge = request.params.data.object
  var amount = charge.amount * 0.01         //单位为 元
  var dealType = Number(charge.metadata.dealType)
  var toUser = charge.metadata.toUser
  var fromUser = charge.metadata.fromUser
  var mysqlConn = undefined

  console.log("收到paymentEvent消息 charge:", charge)
  var deal = {
    from: fromUser,
    to: toUser,
    cost: amount,
    deal_type: dealType,
    charge_id: charge.id,
    order_no: charge.order_no,
    channel: charge.channel,
    transaction_no: charge.transaction_no,
    openid: charge.extra.open_id,
  }
  mysqlUtil.getConnection().then((conn) => {
    mysqlConn = conn
    return mysqlUtil.beginTransaction(conn)
  }).then(() => {
    return updateUserDealRecords(mysqlConn, deal)
  }).then(() => {
    return updateWalletInfo(mysqlConn, deal)
  }).then(() => {
    return mysqlUtil.commit(mysqlConn)
  }).catch((error) => {
    console.log("paymentEvent", error)
    if (mysqlConn) {
      console.log('transaction rollback')
      mysqlUtil.rollback(mysqlConn)
    }
    response.error(error)
  }).finally(() => {
    if (mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
    response.success()
  })
}

function createTransfer(request, response) {
  var order_no = uuidv4().replace(/-/g, '').substr(0, 16)
  var amount = parseInt(request.params.amount * 100).toFixed(0) //人民币分
  var metadata = request.params.metadata
  var dealType = metadata.dealType
  var channel = request.params.channel
  var openid = request.params.openid
  var username = request.params.username

  var description = ''
  if(dealType === REFUND) {
    description = "押金退款"
  } else if(dealType === WITHDRAW) {
    description = "账户提现"
  }

  if(channel == 'wx_pub') { //目前只支持微信公众号提现
    pingpp.transfers.create({
      order_no: order_no,
      app: {id: GLOBAL_CONFIG.PINGPP_APP_ID},
      channel: "wx_pub",
      amount: amount,
      currency: "cny",
      type: "b2c",
      recipient: openid, //微信openId
      extra: {
        // user_name: username,
        // force_check: true,
      },
      description: description ,
      metadata: metadata,
    }, function (err, transfer) {
      if (err != null ) {
        console.log('pingpp.transfers.create', err)
        response.error({
          errcode: 1,
          message: err.message,
        })
        return
      }
      response.success(transfer)
    })
  } else {
    response.error(new Error("目前暂不支持渠道[" + channel + "]提现"))
  }
}

function transferEvent(request, response) {
  var transfer = request.params.data.object
  var toUser = transfer.metadata.toUser
  var fromUser = transfer.metadata.fromUser
  var amount = (transfer.amount * 0.01).toFixed(2)         //单位为 元
  var dealType = transfer.metadata.dealType

  var mysqlConn = undefined
  console.log("收到transferEvent消息 transfer:", transfer)

  var deal = {
    from: fromUser,
    to: toUser,
    cost: amount,
    deal_type: dealType,
    charge_id: transfer.id,
    order_no: transfer.order_no,
    channel: transfer.channel,
    transaction_no: transfer.transaction_no,
    openid: transfer.recipient,
  }

  mysqlUtil.getConnection().then((conn) => {
    mysqlConn = conn
    return mysqlUtil.beginTransaction(conn)
  }).then(() => {
    return updateUserDealRecords(mysqlConn, deal)
  }).then(() => {
    return updateWalletInfo(mysqlConn, deal)
  }).then(() => {
    console.log("transferEvent commit")
    return mysqlUtil.commit(mysqlConn)
  }).catch((error) => {
    console.log(error)
    if (mysqlConn) {
      console.log('transaction rollback')
      mysqlUtil.rollback(mysqlConn)
    }
    response.error(error)
  }).finally(() => {
    if (mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
    response.success()
  })
}

var PingppFunc = {
  DEPOSIT: DEPOSIT,
  RECHARGE: RECHARGE,
  SERVICE: SERVICE,
  REFUND: REFUND,
  WITHDRAW: WITHDRAW,
  createPayment: createPayment,
  paymentEvent: paymentEvent,
  createTransfer: createTransfer,
  transferEvent: transferEvent,
  getWalletInfo: getWalletInfo,
  updateWalletInfo: updateWalletInfo,
}

module.exports = PingppFunc