/**
 * Created by yangyang on 2017/11/4.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import mysqlUtil from '../Util/mysqlUtil'
import moment from 'moment'
import {authFetchUserByPhone} from '../Auth/User'
import {getUserInfoById} from '../Auth'

const WITHDRAW_STATUS = {
  APPLYING: 1,      // 提交申请
  DONE: 2,          // 处理完成
}

const WITHDRAW_APPLY_TYPE = {
  REFUND: 1,        // 微信端用户申请退还押金
  PROFIT: 2,        // 服务单位和投资人申请收益取现
}

/**
 * 为取现生成一条新的数据记录
 * @param request
 * @returns {Function|results|Array}
 */
async function createWithdrawApply(request) {
  let conn = undefined
  let currentUser = request.currentUser
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let userId = currentUser.id
  let openid = currentUser.attributes.authData.weixin.openid
  if (!openid) {
    throw new AV.Cloud.Error('用户未绑定微信号', {code: errno.ERROR_NO_WECHAT})
  }
  let {amount, applyType} = request.params
  try {
    conn = await mysqlUtil.getConnection()
    let iSql = 'INSERT INTO `WithdrawApply` (`userId`, `openid`, `amount`, `applyDate`, `status`, `applyType`) VALUES(?, ?, ?, ?, ?, ?)'
    let insertRes = await mysqlUtil.query(conn, iSql, [userId, openid, amount, moment().format('YYYY-MM-DD HH:mm:ss'), WITHDRAW_STATUS.APPLYING, applyType])
    if (!insertRes.results.insertId) {
      throw new AV.Cloud.Error('生成取现申请失败', {code: errno.EIO})
    }
    return insertRes.results
  } catch (e) {
    throw e
  } finally {
    if (conn) {
      await mysqlUtil.release(conn)
    }
  }
}

/**
 * 确认用户可取现后，将数据库的记录更新
 * @param conn          数据库连接
 * @param operator      操作员id
 * @param orderId       订单id
 * @returns {Function|results|Array}
 */
async function confirmWithdraw(conn, operator, orderId) {
  try {
    let sql = 'UPDATE `WithdrawApply` SET `status`=?, `operator`=?, `operateDate`=? WHERE `id`=?'
    let updateRes = await mysqlUtil.query(conn, sql, [WITHDRAW_STATUS.DONE, operator, moment().format('YYYY-MM-DD HH:mm:ss'), orderId])
    if (0 == updateRes.results.changedRows) {
      throw new AV.Cloud.Error('确认取现出现错误', {code: errno.EIO})
    }
    return updateRes.results
  } catch (e) {
    throw e
  }
}

/**
 * 获取取现记录列表
 * @param request
 * @returns {*}
 */
async function fetchWithdrawRecords(request) {
  let conn = undefined
  let {startTime, endTime, phone, applyType, status, limit} = request.params
  try {
    let sqlParams = []
    conn = await mysqlUtil.getConnection()
    let sql = 'SELECT * FROM `WithdrawApply` '
    if (applyType) {
      sql += 'WHERE `applyType`=? '
      sqlParams.push(applyType)
    } else {
      sql += 'WHERE `applyType` IN (?, ?) '
      sqlParams.push(WITHDRAW_APPLY_TYPE.PROFIT, WITHDRAW_APPLY_TYPE.REFUND)
    }
    if (phone) {
      let user = await authFetchUserByPhone(phone)
      sql += 'AND `userId`=? '
      sqlParams.push(user.id)
    }
    if (startTime && endTime) {
      sql += 'AND `applyDate`>? AND `applyDate`<? '
      sqlParams.push(startTime, endTime)
    }
    if (status) {
      sql += 'AND `status`=? '
      sqlParams.push(status)
    }
    if (limit) {
      sql += 'ORDER BY `applyDate` DESC LIMIT ?'
      sqlParams.push(limit)
    } else {
      sql += 'ORDER BY `applyDate` DESC LIMIT 100'
    }
    let queryRes = await mysqlUtil.query(conn, sql, sqlParams)
    let result = queryRes.results
    if (result.length == 0) {
      return []
    }
    let withdrawList = []
    for (let apply of result) {
      let userInfo = await getUserInfoById(apply.userId)
      let operatorInfo = undefined
      if (apply.operator) {
        operatorInfo = await getUserInfoById(apply.operator)
      }
      let withdrawInfo = {
        ...apply,
        nickname: userInfo.nickname || undefined,
        mobilePhoneNumber: userInfo.mobilePhoneNumber || undefined,
        operatorName: operatorInfo && operatorInfo.nickname ? operatorInfo.nickname : undefined,
      }
      withdrawList.push(withdrawInfo)
    }

    return withdrawList
  } catch (e) {
    throw e
  } finally {
    if (conn) {
      await mysqlUtil.release(conn)
    }
  }
}

/**
 * 获取押金返还信息
 * @param userId
 * @returns {*}
 */
async function getUserRefundRequest(userId) {
  let conn = undefined
  try {
    conn = await mysqlUtil.getConnection()
    let sql = 'SELECT * FROM `WithdrawApply` WHERE `userId`=? AND `applyType`=? AND `status`=? ORDER BY `applyDate` LIMIT 1'

    let queryRes = await mysqlUtil.query(conn, sql, [userId, WITHDRAW_APPLY_TYPE.REFUND, WITHDRAW_STATUS.APPLYING])
    let result = queryRes.results
    if (result.length == 0) {
      return undefined
    }
    return result[0]
  } catch (e) {
    throw e
  } finally {
    if (conn) {
      await mysqlUtil.release(conn)
    }
  }
}

/**
 * 获取用户最后一次申请押金返还的信息
 * @param request
 * @returns {*}
 */
async function fetchUserLastRefund(request) {
  let currentUser = request.currentUser
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }

  try {
    return await getUserRefundRequest(currentUser.id)
  } catch (e) {
    throw new AV.Cloud.Error('查询押金返还信息失败', {code: errno.EIO})
  }
}

const withdrawFunc = {
  WITHDRAW_STATUS,
  WITHDRAW_APPLY_TYPE,
  createWithdrawApply,
  confirmWithdraw,
  fetchWithdrawRecords,
  getUserRefundRequest,
  fetchUserLastRefund,
}

module.exports = withdrawFunc;