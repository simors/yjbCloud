/**
 * Created by lilu on 2017/10/20.
 */
var AV = require('leanengine');
import * as errno from '../errno';

function constructorOperationLog(operation, includeUser) {
  let constructUserInfo = require('../Auth').constructUserInfo
  let operationLog = {}
  operationLog.id = operation.id
  operationLog.operation = operation.attributes.operation
  let user = operation.attributes.user
  operationLog.userId = user ? user.id : undefined
  if (user && includeUser) {
    operationLog.user = constructUserInfo(user)
  }
  operationLog.createdAt = operation.createdAt
  return operationLog
}

/**
 *
 * @param user
 * @param operation
 * @returns {boolean}
 */
async function recordOperation(user, operation) {
  let OperationLog = AV.Object.extend('OperationLog')
  let operationLog = new OperationLog()
  if (!user || !operation) {
    return false
  }
  try {
    operationLog.set('user', user)
    operationLog.set('operation', operation)
    await operationLog.save()
    return true
  } catch (err) {
    throw err
  }
}

/**获取操作日志
 *
 * @param request
 *
 */
async function fetchOperationLogs(request) {
  let {params, currentUser} = request
  if (!currentUser) {
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }
  let {lastCreatedAt, userId, limit ,mobilePhoneNumber, startDate, endDate} = params

  let startQuery = new AV.Query('OperationLog')
  let endQuery = new AV.Query('OperationLog')
  let otherQuery = new AV.Query('OperationLog')

  if(startDate) {
    startQuery.greaterThanOrEqualTo('createdAt', new Date(startDate))
  }
  if(endDate) {
    endQuery.lessThan('createdAt', new Date(endDate))
  }
  if(mobilePhoneNumber){
    let queryUser = new AV.Query('_User')
    queryUser.equalTo('mobilePhoneNumber',mobilePhoneNumber)
    let user = await queryUser.first()
    if(!user){
      throw new AV.Cloud.Error('没有找到该用户', {code: errno.EPERM});
    }
    otherQuery.equalTo('user', user)
  }
  if (userId) {
    let user = AV.Object.createWithoutData('_User', userId)
    otherQuery.equalTo('user', user)
  }
  if (lastCreatedAt) {
    otherQuery.lessThan('createdAt', new Date(lastCreatedAt))
  }
  let query = AV.Query.and(startQuery, endQuery, otherQuery)
  query.limit(limit ? limit : 100)
  query.include(['user'])

  query.descending('createdAt')
  try {
    let operationLogs = await query.find()
    let operationLogList = []
    operationLogs.forEach((item)=> {
      operationLogList.push(constructorOperationLog(item, true))
    })
    return operationLogList
  } catch (err) {
    throw new AV.Cloud.Error('查询操作日志失败。', {code: errno.EPERM});
  }
}

var deviceFunc = {
  recordOperation: recordOperation,
  fetchOperationLogs: fetchOperationLogs
}

module.exports = deviceFunc