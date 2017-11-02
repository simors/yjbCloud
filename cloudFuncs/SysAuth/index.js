/**
 * Created by yangyang on 2017/10/27.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import moment from 'moment'
var Promise = require('bluebird')
var GLOBAL_CONFIG = require('../../config')
var wechat_api = require('../../mpFuncs/index').wechat_api
import utilFunc from '../Util'
import authApi from '../Auth/User'
import authFunc from '../Auth'
const uuidv4 = require('uuid/v4')
var redis = require('redis');

const PRIFIX = 'sysauth:'

async function sendAuthCodeTmpMsg(openid, operator, operation, clientIp, code) {
  let templateId = GLOBAL_CONFIG.WECHAT_MSG_TMPID_AUTH_CODE
  let title = '管理员' + operator + '正在操作”' + operation + '“，如果确认其有权限操作，请将验证码' + code + '告知' + operator
  let addrInfo = await utilFunc.getIpInfo(clientIp)
  let area = addrInfo.region + addrInfo.city

  let data = {
    "first": {
      "value": title,
      "color":"#173177"
    },
    "keyword1": {
      "value": moment().format('YYYY-MM-DD HH:mm:ss'),
      "color":"#173177"
    },
    "keyword2" : {
      "value": clientIp + '(' + area + ')',
      "color":"#173177"
    },
    "remark":{
      "value":"\n此授权码10分钟内有效",
      "color":"#173177"
    }
  }

  wechat_api.sendTemplate(openid, templateId, undefined, data, function (err, result) {
    if(err) {
      console.log("sendAuthCodeTmpMsg", err)
    }
  })
}

async function saveCode(operator, code) {
  Promise.promisifyAll(redis.RedisClient.prototype);
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  // 建议增加 client 的 on error 事件处理，否则可能因为网络波动或 redis server
  // 主从切换等原因造成短暂不可用导致应用进程退出。
  client.on('error', function (err) {
    throw new AV.Cloud.Error('connect to redis error', {code: errno.EIO})
  });

  try {
    let key = PRIFIX + operator
    await client.setAsync(key, code)
    await client.expireAsync(key, 600)    // 有效期为10分钟
  } catch (e) {
    throw new AV.Cloud.Error('save auth code to redis error', {code: errno.EIO})
  } finally {
    client.quit()
  }
}

async function verifyCode(operator, code) {
  Promise.promisifyAll(redis.RedisClient.prototype);
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  // 建议增加 client 的 on error 事件处理，否则可能因为网络波动或 redis server
  // 主从切换等原因造成短暂不可用导致应用进程退出。
  client.on('error', function (err) {
    throw new AV.Cloud.Error('connect to redis error', {code: errno.EIO})
  });

  try {
    let key = PRIFIX + operator
    let savedCode = await client.getAsync(key)
    if (code === savedCode) {
      client.del(key)
      return true
    }
    return false
  } catch (e) {
    throw new AV.Cloud.Error('verify auth code from redis error', {code: errno.EIO})
  } finally {
    client.quit()
  }
}

async function reqSendAuthCode(request) {
  let {operator, operation} = request.params
  let clientIp = request.meta.remoteAddress
  // let clientIp = '113.247.53.242'

  let sysUserList = await authApi.authFetchSysAdminUsers(undefined, undefined, authApi.AUTH_USER_STATUS.ADMIN_NORMAL)
  let sysUser = undefined
  if (sysUserList.jsonUsers && sysUserList.jsonUsers.length > 0) {
    sysUser = sysUserList.jsonUsers[0]
  } else {
    throw new AV.Cloud.Error('there is no system admin user', {code: errno.ENOKEY})
  }
  let openid = sysUser.authData.weixin.openid
  let code = ""
  if(process.env.LEANCLOUD_APP_ID === GLOBAL_CONFIG.LC_DEV_APP_ID) {
    code = '654321'
  } else {
    code = uuidv4().replace(/-/g, '').substr(0, 6)
  }
  try {
    let operatorUser = await authFunc.getUserInfoById(operator)
    await saveCode(operator, code)
    await sendAuthCodeTmpMsg(openid, operatorUser.nickname, operation, clientIp, code)
  } catch (e) {
    throw new AV.Cloud.Error('send auth code wechat mp message error', {code: errno.EIO})
  }
}

async function reqVerifyAuthCode(request) {
  let {operator, code} = request.params

  try {
    let isValid = await verifyCode(operator, code)
    return isValid
  } catch (e) {
    throw new AV.Cloud.Error('verify auth code error', {code: errno.EIO})
  }
}

var sysAuthFunc = {
  reqSendAuthCode,
  reqVerifyAuthCode,
}

module.exports = sysAuthFunc