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
  operationLog.userId = user?user.id:undefined
  if(user&&includeUser) {
    operationLog.user = constructUserInfo(user)
  }
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
  if(!currentUser){
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }
  let query = new AV.Query('OperationLog')
  let {lastCreatedAt, userId} = params
  if(userId){
    let user = AV.Object.createWithoutData('_User', userId)
    query.equalTo('user',user)
  }
  if(lastCreatedAt){
    query.lessThan('createdAt',new Date(lastCreatedAt))
  }
  query.include(['user'])
  query.descending('createdAt')
  try{
    let operationLogs= await query.find()
    let operationLogList = []
    operationLogs.forEach((item)=>{
      operationLogList.push(constructorOperationLog(item))
    })
    return operationLogList
  }catch(err){
    throw new AV.Cloud.Error('查询操作日志失败。', {code: errno.EPERM});
  }
}

var deviceFunc = {
  recordOperation: recordOperation,
  fetchOperationLogs: fetchOperationLogs
}

module.exports = deviceFunc