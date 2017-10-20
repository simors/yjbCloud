/**
 * Created by lilu on 2017/10/20.
 */
var AV = require('leanengine');

/**
 *
 * @param user
 * @param operation
 * @returns {boolean}
 */
async function recordOperation(user,operation) {
  let OperationLog = AV.Object.extend('OperationLog')
  let operationLog = new OperationLog()
  if(!user&&!operation){
    return false
  }else{
    try{
      operationLog.set('user', user)
      operationLog.set('operation', operation)
      await operationLog.save()
      return true
    }catch(err){
      throw err
    }
  }
}

var deviceFunc = {
  recordOperation: recordOperation
}

module.exports = deviceFunc