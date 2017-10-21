/**
 * Created by yangyang on 2017/10/20.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import mysqlUtil from '../Util/mysqlUtil'

const EARN_TYPE = {
  INVEST_EARN: 1,       // 服务点投资收益
  PROVIDER_EARN: 2,     // 服务单位分红收益
}

/**
 * 查询用户的收益余额
 * @param userId  待查询用户id
 * @returns {*}
 */
async function queryAdminProfit(userId) {
  let conn = undefined
  try {
    let qSql = 'SELECT * FROM `AdminProfit` WHERE `userId`=?'
    conn = await mysqlUtil.getConnection()
    let queryRes = await mysqlUtil.query(conn, qSql, [userId])
    if (queryRes.results.length == 0) {
      return undefined
    }
    let adminProfit = queryRes.results[0]
    return adminProfit
  } catch (e) {
    throw e
  } finally {
    if (conn) {
      await mysqlUtil.release(conn)
    }
  }
}

/**
 * 查询用户收益余额的网络请求接口
 * @param request
 * @returns {*}
 */
async function reqAdminProfit(request) {
  let currentUser = request.currentUser
  if (!currentUser) {
    throw new AV.Cloud.Error('User didn\'t login', {code: errno.EINVAL})
  }
  try {
    let adminProfit = await queryAdminProfit(currentUser.id)
    return adminProfit
  } catch (e) {
    throw new AV.Cloud.Error('Query admin profit error', {code: errno.EIO})
  }
}

/**
 * 根据用户id创建一个新的Profit账户，如果已经存在此账户，则什么都不做
 * 调用此方法必须则外部创建数据库事物，将数据连接直接作为参数传人此方法
 * @param conn
 * @param userId
 */
async function createAdminProfit(conn, userId) {
  let qSql = 'SELECT * FROM `AdminProfit` WHERE `userId`=?'
  let queryRes = await mysqlUtil.query(conn, qSql, [userId])
  if (queryRes.results.length !== 0) {
    return
  }
  let iSql = 'INSERT INTO `AdminProfit` (`userId`, `balance`, `invest_earn`, `provider_earn`) VALUES(?, 0, 0, 0)'
  let insertRes = await mysqlUtil.query(conn, iSql, [userId])
  if (!insertRes.results.insertId) {
    throw new AV.Cloud.Error('insert new admin profit record error', {code: errno.EIO})
  }
}

/**
 * 根据收益类型增加用户的收益记录，收益类型包括服务点投资的收益和服务单位分成的收益
 * @param userId    用户id
 * @param type      收益类型，可取值为EARN_TYPE类型的值
 * @param profit    收益金额
 * @returns {Function|results|Array}
 */
async function incAdminProfit(userId, type, profit) {
  let conn = undefined
  try {
    let sql = 'UPDATE `AdminProfit` SET `balance`=`balance`+?, '
    if (type === EARN_TYPE.INVEST_EARN) {
      sql += '`invest_earn`=`invest_earn`+? '
    } else if (type === EARN_TYPE.PROVIDER_EARN) {
      sql += '`provider_earn`=`provider_earn`+? '
    } else {
      throw new AV.Cloud.Error('input type params error', {code: errno.EINVAL})
    }
    sql += 'WHERE `userId`=?'
    conn = await mysqlUtil.getConnection()
    await mysqlUtil.beginTransaction(conn)
    await createAdminProfit(conn, userId)
    let updateRes = await mysqlUtil.query(conn, sql, [profit, profit, userId])
    if (0 == updateRes.results.changedRows) {
      throw new AV.Cloud.Error('increment admin profit error', {code: errno.EIO})
    }
    await mysqlUtil.commit(conn)
    return updateRes.results
  } catch (e) {
    if (conn) {
      await mysqlUtil.rollback(conn)
    }
    throw e
  } finally {
    if (conn) {
      await mysqlUtil.release(conn)
    }
  }
}

/**
 * 减少用户收益余额，通常在用户取现时调用此方法
 * @param userId
 * @param profit
 * @returns {Function|results|Array}
 */
async function decAdminProfit(userId, profit) {
  let conn = undefined
  try {
    let sql = 'UPDATE `AdminProfit` SET `balance`=`balance`-? WHERE `userId`=?'
    conn = await mysqlUtil.getConnection()
    let updateRes = await mysqlUtil.query(conn, sql, [profit, userId])
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

/**
 * incAdminProfit的测试接口
 * @param request
 * @returns {Function|results|Array}
 */
async function reqTestIncProfit(request) {
  let userId = request.params.userId
  let type = request.params.type
  let profit = request.params.profit
  return await incAdminProfit(userId, type, profit)
}

/**
 * decAdminProfit的测试接口
 * @param request
 * @returns {Function|results|Array}
 */
async function reqTestDecProfit(request) {
  let userId = request.params.userId
  let profit = request.params.profit
  return await decAdminProfit(userId, profit)
}

const profitFunc = {
  EARN_TYPE,
  reqAdminProfit,
  incAdminProfit,
  decAdminProfit,
  reqTestIncProfit,
  reqTestDecProfit,
}

module.exports = profitFunc;