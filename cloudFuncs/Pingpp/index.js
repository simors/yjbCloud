/**
 * Created by wanpeng on 2017/8/28.
 */
var GLOBAL_CONFIG = require('../../config')
var pingpp = require('pingpp')(GLOBAL_CONFIG.PINGPP_API_KEY)
var mysqlUtil = require('../Util/mysqlUtil')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')
var dateFormat = require('dateformat')
var mathjs = require('mathjs')
var mpMsgFuncs = require('../../mpFuncs/Message')

// 支付类型定义
const DEPOSIT = 1                // 押金
const RECHARGE = 2               // 充值
const SERVICE = 3                // 服务消费
const REFUND = 4                 // 押金退款
const WITHDRAW = 5               // 提现
const SYS_PRESENT = 6            // 系统赠送


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
  return mysqlUtil.query(conn, recordSql, [deal.from, deal.to, deal.cost, deal.deal_type, charge_id, order_no, channel, transaction_no, feeAmount]).then(() => {
    if(deal.present && deal.present > 0) {
      var present_order_no = uuidv4().replace(/-/g, '').substr(0, 16) //充值赠送新生产一个订单号
      return mysqlUtil.query(conn, recordSql, [deal.to, deal.from, deal.present, SYS_PRESENT, charge_id, present_order_no, channel, transaction_no, feeAmount])
    }
    return undefined
  })
}

function getUserDealRecords(userId, limit, lastTime) {
  var sql = ""
  var mysqlConn = undefined
  var records = []

  return mysqlUtil.getConnection().then((conn) => {
    mysqlConn = conn
    sql = ""
    if(lastTime) {
      sql = "SELECT * FROM `DealRecords` WHERE (`to`=? OR `from`=?) AND `deal_time`<? ORDER BY `deal_time` DESC LIMIT ?"
      return mysqlUtil.query(conn, sql, [userId, userId, dateFormat(lastTime, 'isoDateTime'), limit])
    } else {
      sql = "SELECT * FROM `DealRecords` WHERE `to`=? OR `from`=? ORDER BY `deal_time` DESC LIMIT ?"
      return mysqlUtil.query(conn, sql, [userId, userId, limit])
    }
  }).then((queryRes) => {
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
    return records
  }).catch((error) => {
    console.log('getUserDealRecords', error)
    throw error
  }).finally(() => {
    if (mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  })
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
    sql = "SELECT `userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt`, `score` FROM `Wallet` WHERE `userId` = ?"
    return mysqlUtil.query(conn, sql, [userId])
  }).then((queryRes) => {
    if(queryRes.results.length === 1) {
      walletInfo.userId = queryRes.results[0].userId || userId
      walletInfo.balance = queryRes.results[0].balance || 0
      walletInfo.deposit = queryRes.results[0].deposit || 0
      walletInfo.openid = queryRes.results[0].openid || ""
      walletInfo.debt = queryRes.results[0].debt || 0
      walletInfo.user_name = queryRes.results[0].user_name || ""
      walletInfo.score = queryRes.results[0].score || 0
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
  if (!deal.to|| !deal.from || !deal.cost || !deal.deal_type) {
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

  var openid = deal.openid
  var user_name = deal.user_name || ''
  var balance = 0
  var deposit = 0
  var debt = 0
  var password = ''

  var sql = "SELECT `userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt` FROM `Wallet` WHERE `userId` = ? LIMIT 1"
  return mysqlUtil.query(conn, sql, [userId]).then((queryRes) => {
    if (queryRes.results.length == 1) {
      var currentBalance = mathjs.number(queryRes.results[0].balance)
      var currentDebt = mathjs.number(queryRes.results[0].debt)

      switch (deal.deal_type) {
        case DEPOSIT:
          sql = "UPDATE `Wallet` SET `deposit` = ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case RECHARGE:
          if(currentDebt === 0) {
            sql = "UPDATE `Wallet` SET `balance` = `balance` + ? WHERE `userId` = ?"
            // return mysqlUtil.query(conn, sql, [deal.cost, userId])
            return mysqlUtil.query(conn, sql, [mathjs.eval(deal.cost + deal.present), userId])
          } else if((deal.cost + deal.present) > currentDebt) {
            sql = "UPDATE `Wallet` SET `balance` = `balance` + ?, `debt` = ? WHERE `userId` = ?"
            // return mysqlUtil.query(conn, sql, [deal.cost - currentDebt, 0, userId])
            return mysqlUtil.query(conn, sql, [mathjs.eval(deal.cost + deal.present - currentDebt), 0, userId])
          } else {
            sql = "UPDATE `Wallet` SET `balance` = ?, `debt` = `debt` - ? WHERE `userId` = ?"
            return mysqlUtil.query(conn, sql, [0, mathjs.eval(currentDebt - deal.cost - deal.present), userId])
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
            sql = "UPDATE `Wallet` SET  `debt` = ? WHERE `userId` = ?"
            return mysqlUtil.query(conn, sql, [deal.cost, userId])
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
          balance = mathjs.eval(deal.cost + deal.present)
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
  // var amount = parseInt(request.params.amount * 100).toFixed(0) //人民币分
  var amount = mathjs.number(request.params.amount) * 100
  var channel = request.params.channel
  var metadata = request.params.metadata
  var openid = request.params.openid
  var subject = request.params.subject


  pingpp.setPrivateKeyPath(__dirname + "/rsa_private_key.pem");

  pingpp.charges.create({
    order_no: order_no,// 推荐使用 8-20 位，要求数字或字母，不允许其他字符
    app: {id: GLOBAL_CONFIG.PINGPP_APP_ID},
    channel: channel,// 支付使用的第三方支付渠道取值，请参考：https://www.pingxx.com/api#api-c-new
    // amount: amount,//订单总金额, 人民币单位：分（如订单总金额为 1 元，此处请填 100）
    amount: 0.01, //TODO 提现测试 部署生产环境需修改
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
  // var amount = charge.amount * 0.01         //单位为 元
  var amount = mathjs.number(charge.amount) * 0.01 * 100  //TODO 支付测试金额缩小100倍，部署正式环境需废除
  var dealType = Number(charge.metadata.dealType)
  var toUser = charge.metadata.toUser
  var fromUser = charge.metadata.fromUser
  var payTime = charge.created  //unix时间戳
  var mysqlConn = undefined
  var present = 0   //系统赠送金额

  console.log("收到paymentEvent消息 charge:", charge)
  if(dealType === RECHARGE) {
    if (amount >= 10.0 && amount < 20.0) {
      present = 10.0
    } else if (amount >= 20.0 && amount < 30.0) {
      present = 30.0
    } else if (amount >= 30.0 && amount < 50.0) {
      present = 50.0
    } else if (amount >= 50.0 && amount < 100) {
      present = 70.0
    } else if (amount >= 100 && amount < 200) {
      present = 160
    } else if (amount >= 200) {
      present = 300
    }
  }
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
    present: present,
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
  }).then(() => {
    response.success()
    return getWalletInfo(deal.from).then((walletInfo) => {
      return mpMsgFuncs.sendRechargeTmpMsg(deal.openid, deal.cost, walletInfo.balance, walletInfo.score, new Date(payTime * 1000), deal.deal_type)
    })
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
  })
}

function createTransfer(request, response) {
  var order_no = uuidv4().replace(/-/g, '').substr(0, 16)
  // var amount = parseFloat(request.params.amount).toFixed(2) * 100 //人民币分
  var amount = mathjs.number(request.params.amount) * 100
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
  var amount = mathjs.number(transfer.amount) * 0.01
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
    return mysqlUtil.commit(mysqlConn)
    response.success()
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
  })
}


async function fetchRecharges(request, response) {
  let authFunc = require('../Auth')
  let currentUser = request.currentUser
  let start = request.params.start
  let end = request.params.end
  let mobilePhoneNumber = request.params.mobilePhoneNumber
  let isRefresh = request.params.isRefresh || true    //分页查询刷新
  let lastDealTime = request.params.lastDealTime  //分页查询历史查询最后一条记录的设备更新时间
  let limit = request.params.limit || 10
  let userId = undefined
  let rechargeList = []

  try {
    let sql = ""
    let queryParams = undefined
    let mysqlConn = await mysqlUtil.getConnection()

    if(mobilePhoneNumber && start && end) {
      userId = await authFunc.getUserId(mobilePhoneNumber)
      sql = "SELECT * FROM `DealRecords` WHERE `deal_type`=? AND `deal_time`>? AND `deal_time`<? AND `from`=?  ORDER BY `deal_time` DESC LIMIT ?"
      if(isRefresh) {
        queryParams = [RECHARGE, dateFormat(new Date(start), 'isoDateTime'), dateFormat(new Date(end), 'isoDateTime'), userId, limit]
      } else {
        queryParams = [RECHARGE, dateFormat(new Date(start), 'isoDateTime'), dateFormat(new Date(lastDealTime), 'isoDateTime'), userId, limit]
      }
    } else if (!mobilePhoneNumber && start && end) {
      sql = "SELECT * FROM `DealRecords` WHERE `deal_type`=? AND `deal_time`>? AND `deal_time`<? ORDER BY `deal_time` DESC LIMIT ?"
      if(isRefresh) {
        queryParams = [RECHARGE, dateFormat(new Date(start), 'isoDateTime'), dateFormat(new Date(end), 'isoDateTime'), limit]
      } else {
        queryParams = [RECHARGE, dateFormat(new Date(start), 'isoDateTime'), dateFormat(new Date(lastDealTime), 'isoDateTime'), limit]
      }
    } else if (mobilePhoneNumber && !start && !end) {
      userId = await authFunc.getUserId(mobilePhoneNumber)
      if(isRefresh) {
        sql = "SELECT * FROM `DealRecords` WHERE `deal_type`=? AND `from`=?  ORDER BY `deal_time` DESC LIMIT ?"
        queryParams = [RECHARGE, userId, limit]
      } else {
        sql = "SELECT * FROM `DealRecords` WHERE `deal_type`=? AND `deal_time`<? AND `from`=?  ORDER BY `deal_time` DESC LIMIT ?"
        queryParams = [RECHARGE, dateFormat(new Date(lastDealTime), 'isoDateTime'), userId, limit]
      }
    } else if (!mobilePhoneNumber && !start && !end) {
      if(isRefresh) {
        sql = "SELECT * FROM `DealRecords` WHERE `deal_type`=? ORDER BY `deal_time` DESC LIMIT ?"
        queryParams = [RECHARGE, limit]
      } else {
        sql = "SELECT * FROM `DealRecords` WHERE `deal_type`=? AND `deal_time`<?  ORDER BY `deal_time` DESC LIMIT ?"
        queryParams = [RECHARGE, dateFormat(new Date(lastDealTime), 'isoDateTime'), limit]
      }
    } else {
      response.error(new Error("参数错误"))
      return
    }

    let queryRes = await mysqlUtil.query(mysqlConn, sql, queryParams)
    if(queryRes.results.length > 0) {
      for (let deal of queryRes.results) {
        let record = {}
        record.id = deal.charge_id
        record.order_no = deal.order_no
        record.userId = deal.from
        record.user = await authFunc.getUserInfoById(deal.from)
        record.cost = deal.cost
        record.dealTime = deal.deal_time
        rechargeList.push(record)
      }
    }

    response.success(rechargeList)
    if(mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  } catch (error) {
    console.error(error)
    response.error(error)
  }
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
  getUserDealRecords: getUserDealRecords,
  fetchRecharges: fetchRecharges,
}

module.exports = PingppFunc