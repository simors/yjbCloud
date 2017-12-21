/**
 * Created by wanpeng on 2017/8/28.
 */
import AV from 'leanengine'
var GLOBAL_CONFIG = require('../../config')
var pingpp = require('pingpp')(GLOBAL_CONFIG.PINGPP_API_KEY)
var mysqlUtil = require('../Util/mysqlUtil')
var Promise = require('bluebird')
const uuidv4 = require('uuid/v4')
var dateFormat = require('dateformat')
var mathjs = require('mathjs')
var mpMsgFuncs = require('../../mpFuncs/Message')
import promotionFunc from '../Promotion'
import profitFunc from '../Profit'
import * as errno from '../errno'

// 交易类型定义
const DEAL_TYPE_DEPOSIT = 1                // 押金
const DEAL_TYPE_RECHARGE = 2               // 充值
const DEAL_TYPE_SERVICE = 3                // 服务消费
const DEAL_TYPE_REFUND = 4                 // 押金退款
const DEAL_TYPE_WITHDRAW = 5               // 提现
const DEAL_TYPE_SYS_PRESENT = 6            // 系统赠送
const DEAL_TYPE_ORDER_PAY = 7              // 订单支付

const WALLET_PROCESS_TYPE = {
  NORMAL_PROCESS: 0,    // 正常状态
  REFUND_PROCESS: 1,    // 正在提取押金
}

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
  let promotionId = deal.metadata? deal.metadata.promotionId : undefined
  let award = deal.metadata? deal.metadata.award : undefined
  var recordSql = 'INSERT INTO `DealRecords` (`from`, `to`, `cost`, `deal_type`, `charge_id`, `order_no`, `channel`, `transaction_no`, `fee`, `promotion_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  return mysqlUtil.query(conn, recordSql, [deal.from, deal.to, deal.cost, deal.deal_type, charge_id, order_no, channel, transaction_no, feeAmount, promotionId || '']).then(() => {
    if(deal.deal_type === DEAL_TYPE_RECHARGE && promotionId && award > 0) {
      let present_order_no = uuidv4().replace(/-/g, '').substr(0, 16) //充值赠送新生产一个订单号
      return mysqlUtil.query(conn, recordSql, [deal.to, deal.from, award, DEAL_TYPE_SYS_PRESENT, charge_id, present_order_no, channel, transaction_no, feeAmount, promotionId])
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
    sql = "SELECT `userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt`, `process` FROM `Wallet` WHERE `userId` = ?"
    return mysqlUtil.query(conn, sql, [userId])
  }).then((queryRes) => {
    if(queryRes.results.length === 1) {
      walletInfo.userId = queryRes.results[0].userId || userId
      walletInfo.balance = queryRes.results[0].balance || 0
      walletInfo.deposit = queryRes.results[0].deposit || 0
      walletInfo.openid = queryRes.results[0].openid || ""
      walletInfo.debt = queryRes.results[0].debt || 0
      walletInfo.user_name = queryRes.results[0].user_name || ""
      walletInfo.process = queryRes.results[0].process || WALLET_PROCESS_TYPE.NORMAL_PROCESS
      return walletInfo
    } else {
      return createUserWallet(userId)
    }
  }).catch((error) => {
    console.log('getWalletInfo', error)
    throw error
  }).finally(() => {
    if (mysqlConn) {
      mysqlUtil.release(mysqlConn)
    }
  })
}

async function createUserWallet(userId, openid) {
  if(!userId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    let sql = "SELECT * FROM `Wallet` WHERE `userId` = ?"
    let queryRes = await mysqlUtil.query(mysqlConn, sql, [userId])
    if(queryRes.results.length === 0) {
      sql = "INSERT INTO `Wallet` (`userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt`, `process`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      await mysqlUtil.query(mysqlConn, sql, [userId, 0, 0, '', openid || '', '', 0, WALLET_PROCESS_TYPE.NORMAL_PROCESS])
      return {
        userId: userId,
        balance: 0,
        deposit: 0,
        openid: '',
        debt: 0,
        user_name: '',
        process: WALLET_PROCESS_TYPE.NORMAL_PROCESS,
      }
    } else {
      throw new AV.Cloud.Error('用户钱包信息已存在', {code: errno.EEXIST})
    }
  } catch (error) {
    console.error("createUserWallet", error)
    throw error
  } finally {
    if (mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }

}

function judgeWalletProcess(wallet) {
  return WALLET_PROCESS_TYPE.NORMAL_PROCESS == wallet.process
}

function judgeWalletRefund(wallet, deposit) {
  return wallet.deposit == deposit
}

function judgeWalletDebt(wallet) {
  return wallet.debt === 0
}

/**
 * 判断用户是否可以做提取押金的操作
 * @param userId
 * @param deposit
 * @returns {number}
 */
async function isRefundAllowed(userId, deposit) {
  try {
    let wallet = await getWalletInfo(userId)
    if (!judgeWalletProcess(wallet)) {
      return errno.ERROR_IN_REFUND_PROCESS
    }
    if (!judgeWalletRefund(wallet, deposit)) {
      return errno.ERROR_NOT_MATCH_DEPOSIT
    }
    if(!judgeWalletDebt(wallet)) {
      return errno.ERROR_UNPAID_ORDER
    }
    let getOccupiedOrder = require('../Order').getOccupiedOrder
    let occupiedOrder = await getOccupiedOrder(userId)
    if(occupiedOrder) {
      return errno.ERROR_OCCUPIED_ORDER
    }
    return 0
  } catch (e) {
    throw e
  }
}

/**
 * 更新用户钱包的process处理状态，process的可取值为WALLET_PROCESS_TYPE
 * @param userId      用户id
 * @param process     待修改状态
 * @returns {Function|results|Array}
 */
async function updateWalletProcess(userId, process) {
  let conn = undefined
  try {
    conn = await mysqlUtil.getConnection()
    let sql = 'UPDATE `Wallet` SET `process`=? WHERE `userId`=?'
    let updateRes = await mysqlUtil.query(conn, sql, [process, userId])
    if (0 == updateRes.results.changedRows) {
      throw new AV.Cloud.Error('update wallet process error', {code: errno.EIO})
    }
    return updateRes.results
  } catch (e) {
    throw e
  } finally {
    if (conn) {
      await mysqlUtil.release(conn)
    }
  }
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
    case DEAL_TYPE_DEPOSIT:
    case DEAL_TYPE_RECHARGE:
    case DEAL_TYPE_ORDER_PAY:
    case DEAL_TYPE_SERVICE:
      userId = deal.from
      break
    case DEAL_TYPE_REFUND:
    case DEAL_TYPE_WITHDRAW:
      userId = deal.to
      break
    case DEAL_TYPE_SYS_PRESENT:
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

  var sql = "SELECT `userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt`, `process` FROM `Wallet` WHERE `userId` = ? LIMIT 1"
  return mysqlUtil.query(conn, sql, [userId]).then((queryRes) => {
    if (queryRes.results.length == 1) {
      var currentBalance = mathjs.number(queryRes.results[0].balance)

      switch (deal.deal_type) {
        case DEAL_TYPE_DEPOSIT:
          sql = "UPDATE `Wallet` SET `deposit` = ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case DEAL_TYPE_RECHARGE:
          sql = "UPDATE `Wallet` SET `balance` = `balance` + ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [mathjs.chain(deal.cost).add(deal.metadata.award).done(), userId])
          break
        case DEAL_TYPE_WITHDRAW:
          sql = "UPDATE `Wallet` SET `balance` = `balance` - ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case DEAL_TYPE_ORDER_PAY:
          if(currentBalance < deal.cost) {
            throw new AV.Cloud.Error('用户余额不足', {code: errno.ERROR_NO_ENOUGH_BALANCE})
          }
          sql = "UPDATE `Wallet` SET `balance` = `balance` - ?, `debt` = ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, 0, userId])
          break
        case DEAL_TYPE_SERVICE:
          sql = "UPDATE `Wallet` SET  `debt` = `debt` + ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case DEAL_TYPE_REFUND:
          sql = "UPDATE `Wallet` SET `deposit` = `deposit` - ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        case DEAL_TYPE_SYS_PRESENT:
          sql = "UPDATE `Wallet` SET `balance` = `balance` + ? WHERE `userId` = ?"
          return mysqlUtil.query(conn, sql, [deal.cost, userId])
          break
        default:
          return Promise.resolve()
          break
      }
    } else {
      switch (deal.deal_type) {
        case DEAL_TYPE_DEPOSIT:
          deposit = deal.cost
          break
        case DEAL_TYPE_RECHARGE:
          balance = mathjs.chain(deal.cost).add(deal.metadata.award).done()
          break
        case DEAL_TYPE_SERVICE:
          debt = deal.cost
          break
        case DEAL_TYPE_SYS_PRESENT:
          balance = deal.cost
          break
        case DEAL_TYPE_WITHDRAW:
        case DEAL_TYPE_REFUND:
        case DEAL_TYPE_ORDER_PAY:
        default:
          throw new AV.Cloud.Error('钱包信息有误', {code: errno.ERROR_NO_WALLET})
          break
      }
      sql = "INSERT INTO `Wallet` (`userId`, `balance`, `deposit`, `password`, `openid`, `user_name`, `debt`, `process`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      return mysqlUtil.query(conn, sql, [userId, balance, deposit, password, openid, user_name, debt, WALLET_PROCESS_TYPE.NORMAL_PROCESS])
    }
  }).catch((error) => {
    console.log("updateWalletInfo", error)
    throw error
  })
}


async function createPayment(request) {
  var order_no = uuidv4().replace(/-/g, '').substr(0, 16)
  var amount = mathjs.number(request.params.amount) * 100
  var channel = request.params.channel
  var metadata = request.params.metadata
  var openid = request.params.openid
  var subject = request.params.subject

  let promotionId = metadata? metadata.promotionId : undefined
  let userId = metadata? metadata.fromUser : undefined
  if(promotionId && userId) {
    let promotion = await promotionFunc.getValidPromotion(userId, promotionFunc.PROMOTION_CATEGORY_TYPE_RECHARGE)
    if(!promotion || promotion.id != promotionId) {
      throw new AV.Cloud.Error('活动已失效', {code: errno.ERROR_PROM_INVALID})
    }
  }

  if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_DEV_APP_ID) {
    amount = mathjs.chain(amount).multiply(0.01).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_STAGE_APP_ID) {
    amount = mathjs.chain(amount).multiply(0.01).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_PRO_APP_ID) {
  }

  pingpp.setPrivateKeyPath(__dirname + "/rsa_private_key.pem");
  try {
    let charges = await new Promise((resolve, reject) => {
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
          reject(new AV.Cloud.Error('request charges error' + err.message, {code: errno.ERROR_CREATE_CHARGES}))
        }
        resolve(charge)
      })
    })
    return charges
  } catch (e) {
    throw e
  }
}

async function paymentEvent(request) {
  var charge = request.params.data.object
  var amount = mathjs.chain(charge.amount).multiply(0.01).done()       //单位为 元
  if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_DEV_APP_ID) {
    amount = mathjs.chain(amount).multiply(100).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_STAGE_APP_ID) {
    amount = mathjs.chain(amount).multiply(100).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_PRO_APP_ID) {
  }
  var dealType = Number(charge.metadata.dealType)
  var toUser = charge.metadata.toUser
  var fromUser = charge.metadata.fromUser
  var payTime = charge.created  //unix时间戳

  let updateUserScore = require('../Score').updateUserScore
  let SCORE_OP_TYPE_DEPOSIT = require('../Score').SCORE_OP_TYPE_DEPOSIT
  let SCORE_OP_TYPE_RECHARGE = require('../Score').SCORE_OP_TYPE_RECHARGE
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
    payTime: payTime,
    metadata: charge.metadata,
  }
  try {
    switch (dealType) {
      case DEAL_TYPE_DEPOSIT:
        await handleDepositDeal(deal)
        break
      case DEAL_TYPE_RECHARGE:
        await handleRechargeDeal(deal)
        break
      default:
        break
    }
  } catch (error) {
    console.error(error)
    throw error
  }
  try {
    switch (dealType) {
      case DEAL_TYPE_DEPOSIT:
        await updateUserScore(fromUser, SCORE_OP_TYPE_DEPOSIT, {})
        break
      case DEAL_TYPE_RECHARGE:
        await updateUserScore(fromUser, SCORE_OP_TYPE_RECHARGE, {recharge: amount})
        break
      default:
        break
    }
  } catch (error) {
    console.error(error)
  }
}
/**
 * 处理用户支付押金交易
 * @param deal
 */
async function handleDepositDeal(deal) {
  if(!deal) {
    return undefined
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    await mysqlUtil.beginTransaction(mysqlConn)
    await updateUserDealRecords(mysqlConn, deal)
    await updateWalletInfo(mysqlConn, deal)
    await mysqlUtil.commit(mysqlConn)

  } catch (error) {
    if(mysqlConn) {
      await mysqlUtil.rollback(mysqlConn)
    }
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
}
/**
 * 处理微信端用户充值交易
 * @param deal
 */
async function handleRechargeDeal(deal) {
  if(!deal) {
    return undefined
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    await mysqlUtil.beginTransaction(mysqlConn)
    await updateUserDealRecords(mysqlConn, deal)
    await updateWalletInfo(mysqlConn, deal)
    await mysqlUtil.commit(mysqlConn)

  } catch (error) {
    console.error(error)
    if(mysqlConn) {
      await mysqlUtil.rollback(mysqlConn)
    }
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
  try {
    let userWalletInfo = await getWalletInfo(deal.from)
    let getUserInfoById = require('../Auth').getUserInfoById
    let userInfo = await getUserInfoById(deal.from)
    await mpMsgFuncs.sendRechargeTmpMsg(deal.openid, deal.cost, userWalletInfo.balance, userInfo.score, new Date(deal.payTime * 1000), deal.deal_type)
    if(deal.metadata.promotionId) {
      await promotionFunc.updateRechargePromStat(deal.metadata.promotionId, deal.cost, deal.metadata.award)
      await promotionFunc.addPromotionRecord(deal.metadata.promotionId, deal.from, {recharge: deal.cost, award: deal.metadata.award})
    }
  } catch (error) {
    console.error(error)
  }
}

async function handleRedEnvelopeDeal(promotionId, userId, amount) {
  if(!promotionId || !userId || !amount) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let deal = {
    from: 'platform',
    to: userId,
    cost: amount,
    deal_type: DEAL_TYPE_SYS_PRESENT,
    charge_id: "",
    order_no: uuidv4().replace(/-/g, '').substr(0, 16),
    channel: "",
    transaction_no: "",
    openid: "",
    payTime: Date.now(),
    metadata: {promotionId: promotionId},
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    await mysqlUtil.beginTransaction(mysqlConn)
    await updateUserDealRecords(mysqlConn, deal)
    await updateWalletInfo(mysqlConn, deal)

    await mysqlUtil.commit(mysqlConn)
  } catch (error) {
    console.error(error)
    if(mysqlConn) {
      await mysqlUtil.rollback(mysqlConn)
    }
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
  return
}

async function createTransfer(request) {
  var order_no = uuidv4().replace(/-/g, '').substr(0, 16)
  let originalAmount = request.params.amount
  var amount = mathjs.number(originalAmount) * 100
  var metadata = request.params.metadata
  var dealType = metadata.dealType
  var channel = request.params.channel
  var openid = request.params.openid
  let toUser = metadata.toUser

  if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_DEV_APP_ID) {
    amount = mathjs.chain(amount).multiply(0.1).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_STAGE_APP_ID) {
    amount = mathjs.chain(amount).multiply(0.1).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_PRO_APP_ID) {
  }

  if(channel !== 'wx_pub') { //目前只支持微信公众号提现
    throw new AV.Cloud.Error('only support wx withdraw', {code: errno.ERROR_UNSUPPORT_CHANNEL})
  }

  pingpp.setPrivateKeyPath(__dirname + "/rsa_private_key.pem");
  var description = ''
  let errcode = 0
  if(dealType === DEAL_TYPE_REFUND) {
    description = "押金退款"
    errcode = await isRefundAllowed(toUser, originalAmount)
    if (0 != errcode) {
      throw new AV.Cloud.Error('cann\'t refund', {code: errcode})
    }
  } else if(dealType === DEAL_TYPE_WITHDRAW) {
    description = "账户提现"
    errcode = await profitFunc.isWithdrawAllowed(toUser, originalAmount)
    if (0 != errcode) {
      throw new AV.Cloud.Error('cann\'t withdraw', {code: errcode})
    }
  }
  try {
    let transfer = await new Promise((resolve, reject) => {
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
          console.error(err)
          reject(new AV.Cloud.Error('request transfer error' + err.message, {code: errno.ERROR_CREATE_TRANSFER}))
        }
        resolve(transfer)
      })
    })
    if(dealType === DEAL_TYPE_REFUND) {
      await updateWalletProcess(toUser, WALLET_PROCESS_TYPE.REFUND_PROCESS)
    } else if(dealType === DEAL_TYPE_WITHDRAW) {
      await profitFunc.updateAdminProfitProcess(toUser, profitFunc.PROCESS_TYPE.WITHDRAW_PROCESS)
    }
    return await getWalletInfo(toUser)
  } catch (e) {
    throw e
  }
}

async function transferEvent(request) {
  var transfer = request.params.data.object
  var toUser = transfer.metadata.toUser
  var fromUser = transfer.metadata.fromUser
  var amount = mathjs.chain(transfer.amount).multiply(0.01).done()
  var dealType = transfer.metadata.dealType
  var operator = transfer.metadata.operator
  var withdrawId = transfer.metadata.withdrawId

  if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_DEV_APP_ID) {
    amount = mathjs.chain(amount).multiply(10).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_STAGE_APP_ID) {
    amount = mathjs.chain(amount).multiply(10).done()
  } else if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_PRO_APP_ID) {
  }

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
    metadata: transfer.metadata
  }

  try {
    switch (dealType) {
      case DEAL_TYPE_REFUND:
      {
        try {
          await handleRefundDeal(deal, operator, withdrawId)
          await updateWalletProcess(deal.to, WALLET_PROCESS_TYPE.NORMAL_PROCESS)
        } catch (e) {
          throw e
        }
        break
      }
      case DEAL_TYPE_WITHDRAW:
      {
        try {
          await handleWithdrawDeal(deal, operator, withdrawId)
          await profitFunc.updateAdminProfitProcess(deal.to, profitFunc.PROCESS_TYPE.NORMAL_PROCESS)
        } catch (e) {
          throw e
        }
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function handleRefundDeal(deal, operator, withdrawId) {
  let confirmWithdraw = require('../Withdraw').confirmWithdraw
  if(!deal) {
    return undefined
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    await mysqlUtil.beginTransaction(mysqlConn)
    await updateUserDealRecords(mysqlConn, deal)
    await updateWalletInfo(mysqlConn, deal)
    await confirmWithdraw(mysqlConn, operator, withdrawId)
    await mysqlUtil.commit(mysqlConn)
  } catch (error) {
    if(mysqlConn) {
      await mysqlUtil.rollback(mysqlConn)
    }
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
}

async function handleWithdrawDeal(deal, operator, withdrawId) {
  let confirmWithdraw = require('../Withdraw').confirmWithdraw
  if(!deal) {
    return undefined
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    await mysqlUtil.beginTransaction(mysqlConn)
    await updateUserDealRecords(mysqlConn, deal)
    await profitFunc.decAdminProfit(mysqlConn, deal.to, deal.cost)
    await confirmWithdraw(mysqlConn, operator, withdrawId)
    await mysqlUtil.commit(mysqlConn)
  } catch (error) {
    if(mysqlConn) {
      await mysqlUtil.rollback(mysqlConn)
    }
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
}

/**
 * 分页查询交易记录
 * @param request
 */
async function fetchDealRecord(request) {
  let getUserId = require('../Auth').getUserId
  let getUserInfoById = require('../Auth').getUserInfoById
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  const {start, end, mobilePhoneNumber, isRefresh, lastDealTime, limit, dealType} = params
  let userId = params.userId
  if(isRefresh === false && !lastDealTime) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  if(!userId && mobilePhoneNumber) {
    userId = await getUserId(mobilePhoneNumber)
  }
  let total = undefined
  let lmt = limit || 10
  let sql = "SELECT * FROM `DealRecords` "
  let countSql = "SELECT COUNT(*) AS count FROM `DealRecords` "
  let queryParams = []
  let countQueryParams = []
  let mysqlConn = undefined

  try {
    mysqlConn = await mysqlUtil.getConnection()
    if(dealType) {
      sql = sql + "WHERE `deal_type`=? "
      countSql = countSql + "WHERE `deal_type`=? "
      queryParams.push(Number(dealType))
      countQueryParams.push(Number(dealType))
    }

    if(start && end) {
      sql = sql + ((sql.indexOf("WHERE") > 0)? "AND `deal_time`>? " : "WHERE `deal_time`>? ")
      countSql = countSql + ((countSql.indexOf("WHERE") > 0)? "AND `deal_time`>? " : "WHERE `deal_time`>? ")
      queryParams.push(dateFormat(new Date(start), 'isoDateTime'))
      countQueryParams.push(dateFormat(new Date(start), 'isoDateTime'))
      if(isRefresh === false) {
        sql = sql + "AND `deal_time`<? "
        queryParams.push(dateFormat(new Date(lastDealTime), 'isoDateTime'))
      } else {
        sql = sql + "AND `deal_time`<? "
        queryParams.push(dateFormat(new Date(end), 'isoDateTime'))
      }
      countSql = countSql + "AND `deal_time`<? "
      countQueryParams.push(dateFormat(new Date(end), 'isoDateTime'))
    } else if(!start && !end) {
      if(isRefresh === false) {
        sql = sql + ((sql.indexOf("WHERE") > 0)? "AND `deal_time`<? " : "WHERE `deal_time`<? ")
        queryParams.push(dateFormat(new Date(lastDealTime), 'isoDateTime'))
      }
    } else {
      throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
    }

    if(userId) {
      if(dealType === undefined) {
        sql = sql + ((sql.indexOf("WHERE") > 0)? "AND (`from`=? OR `to`=?)  " : "WHERE (`from`=? OR `to`=?) ")
        queryParams.push(userId)
        queryParams.push(userId)
        countSql = countSql + ((countSql.indexOf("WHERE") > 0)? "AND (`from`=? OR `to`=?) " : "WHERE (`from`=? OR `to`=?) ")
        countQueryParams.push(userId)
        countQueryParams.push(userId)
      } else if(dealType === DEAL_TYPE_DEPOSIT
        || dealType === DEAL_TYPE_RECHARGE
        || dealType === DEAL_TYPE_SERVICE
        || dealType === DEAL_TYPE_ORDER_PAY) {
        sql = sql + ((sql.indexOf("WHERE") > 0)? "AND `from`=?  " : "WHERE `from`=?  ")
        countSql = countSql + ((countSql.indexOf("WHERE") > 0)? "AND `from`=?  " : "WHERE `from`=?  ")
        queryParams.push(userId)
        countQueryParams.push(userId)
      } else if(dealType === DEAL_TYPE_REFUND
        || dealType === DEAL_TYPE_WITHDRAW
        || dealType === DEAL_TYPE_SYS_PRESENT) {
        sql = sql + ((sql.indexOf("WHERE") > 0)? "AND `to`=?  " : "WHERE `to`=?  ")
        countSql = countSql + ((countSql.indexOf("WHERE") > 0)? "AND `to`=?  " : "WHERE `to`=?  ")
        queryParams.push(userId)
        countQueryParams.push(userId)
      }
    }
    sql = sql + "ORDER BY `deal_time` DESC LIMIT ?"
    queryParams.push(lmt)

    let queryRes = await mysqlUtil.query(mysqlConn, sql, queryParams)
    if(isRefresh === true) {
      let countQueryRes = await mysqlUtil.query(mysqlConn, countSql, countQueryParams)
      total = countQueryRes.results[0].count
    }
    let dealList = []
    if(queryRes.results.length > 0) {
      for (let deal of queryRes.results) {
        let record = {}
        record.id = deal.id
        record.order_no = deal.order_no
        switch (deal.deal_type) {
          case DEAL_TYPE_DEPOSIT:
          case DEAL_TYPE_RECHARGE:
          case DEAL_TYPE_SERVICE:
          case DEAL_TYPE_ORDER_PAY:
            record.userId = deal.from
            record.user = await getUserInfoById(deal.from)
            break
          case DEAL_TYPE_REFUND:
          case DEAL_TYPE_WITHDRAW:
          case DEAL_TYPE_SYS_PRESENT:
            record.userId = deal.to
            record.user = await getUserInfoById(deal.to)
            break
          default:
            break
        }
        record.cost = deal.cost
        record.dealTime = deal.deal_time
        record.dealType = deal.deal_type
        record.promotionId = deal.promotion_id
        dealList.push(record)
      }
    }
    return {total: total, dealList: dealList}
  } catch (error) {
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
}

/**
 * 查询平台押金池总金额.
 * @param {object} request
 * params = {
 * }
 * @returns {Promise.<Number>}
 */
async function fetchDepositAmount(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    let sql = "SELECT SUM(`deposit`) as amount from `Wallet`"
    let queryRes = await mysqlUtil.query(mysqlConn, sql)
    let amount = queryRes.results[0].amount
    return amount
  } catch (error) {
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
}

/**
 * 查询平台充值总金额.
 * @param {object} request
 * params = {
 * }
 * @returns {Promise.<Number>}
 */
async function fetchRechargeAmount(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let mysqlConn = undefined
  try {
    mysqlConn = await mysqlUtil.getConnection()
    let sql = "SELECT SUM(`cost`) as amount from `DealRecords` WHERE `deal_type` = ?"
    let queryRes = await mysqlUtil.query(mysqlConn, sql, [DEAL_TYPE_RECHARGE])
    let amount = queryRes.results[0].amount
    return amount
  } catch (error) {
    throw error
  } finally {
    if(mysqlConn) {
      await mysqlUtil.release(mysqlConn)
    }
  }
}

async function pingppFuncTest(request) {
  const {currentUser, params} = request
  return await createUserWallet(currentUser.id)
}

var PingppFunc = {
  WALLET_PROCESS_TYPE: WALLET_PROCESS_TYPE,
  DEAL_TYPE_DEPOSIT: DEAL_TYPE_DEPOSIT,
  DEAL_TYPE_RECHARGE: DEAL_TYPE_RECHARGE,
  DEAL_TYPE_SERVICE: DEAL_TYPE_SERVICE,
  DEAL_TYPE_REFUND: DEAL_TYPE_REFUND,
  DEAL_TYPE_WITHDRAW: DEAL_TYPE_WITHDRAW,
  DEAL_TYPE_ORDER_PAY: DEAL_TYPE_ORDER_PAY,
  createPayment: createPayment,
  paymentEvent: paymentEvent,
  createTransfer: createTransfer,
  transferEvent: transferEvent,
  getWalletInfo: getWalletInfo,
  updateWalletInfo: updateWalletInfo,
  handleRedEnvelopeDeal: handleRedEnvelopeDeal,
  createUserWallet: createUserWallet,
  fetchDealRecord: fetchDealRecord,
  fetchDepositAmount: fetchDepositAmount,
  fetchRechargeAmount: fetchRechargeAmount,
  updateUserDealRecords: updateUserDealRecords,
  isRefundAllowed: isRefundAllowed,
  pingppFuncTest: pingppFuncTest,
}

module.exports = PingppFunc