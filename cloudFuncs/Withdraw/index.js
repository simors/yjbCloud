/**
 * Created by yangyang on 2017/11/4.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import mysqlUtil from '../Util/mysqlUtil'
import moment from 'moment'

const WITHDRAW_STATUS = {
  APPLYING: 0,      // 提交申请
  DONE: 1,          // 处理完成
}

const WITHDRAW_APPLY_TYPE = {
  REFUND: 1,        // 微信端用户申请退还押金
  PROFIT: 2,        // 服务单位和投资人申请收益取现
}

async function createWithdrawApply(request) {
  let conn = undefined
  let {userId, openid, amount, applyType} = request.params
  try {
    conn = await mysqlUtil.getConnection()
    let iSql = 'INSERT INTO `WithdrawApply` (`userId`, `openid`, `amount`, `applyDate`, `status`, `applyType`) VALUES(?, ?, ?, ?, ?)'
    let insertRes = await mysqlUtil.query(conn, iSql, [userId, openid, amount, moment().format('YYYY-MM-DD'), WITHDRAW_STATUS.APPLYING, applyType])
    if (!insertRes.results.insertId) {
      throw new AV.Cloud.Error('insert new admin profit record error', {code: errno.EIO})
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

async function confirmWithdraw(operator, orderId) {
  let conn = undefined
  try {
    conn = await mysqlUtil.getConnection()
    let sql = 'UPDATE `WithdrawApply` SET `status`=?, `operator`=?, `operateDate`=? WHERE `id`=?'
    let updateRes = await mysqlUtil.query(conn, sql, [WITHDRAW_STATUS.DONE, operator, moment().format('YYYY-MM-DD'), orderId])
    if (0 == updateRes.results.changedRows) {
      throw new AV.Cloud.Error('increment admin profit error', {code: errno.EIO})
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

const withdrawFunc = {
  WITHDRAW_STATUS,
  WITHDRAW_APPLY_TYPE,
  createWithdrawApply,
  confirmWithdraw,
}

module.exports = withdrawFunc;