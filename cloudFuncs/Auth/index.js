/**
 * Created by wanpeng on 2017/8/7.
 */
import AV from 'leanengine'
import PingppFunc from '../Pingpp'
import * as errno from '../errno'

export function constructUserInfo(user, roles=undefined) {
  if(!user) {
    return undefined
  }
  var userAttr = user.attributes
  if(!userAttr) {
    return undefined
  }

  var userInfo = {}
  userInfo.id = user.id
  userInfo.state = userAttr.state
  userInfo.email = userAttr.email
  userInfo.emailVerified = userAttr.emailVerified
  userInfo.mobilePhoneNumber = userAttr.mobilePhoneNumber
  userInfo.mobilePhoneVerified = userAttr.mobilePhoneVerified
  userInfo.authData = userAttr.authData
  userInfo.username = userAttr.username
  userInfo.nickname = userAttr.nickname
  userInfo.avatar = userAttr.avatar
  userInfo.sex = userAttr.sex
  userInfo.language = userAttr.language
  userInfo.country = userAttr.country
  userInfo.province = userAttr.province
  userInfo.city = userAttr.city
  userInfo.idNumber = userAttr.idNumber
  userInfo.idName = userAttr.idName
  userInfo.idNameVerified = userAttr.idNameVerified
  userInfo.createdAt = user.createdAt
  userInfo.updatedAt = user.updatedAt
  userInfo.type = userAttr.type         // 'end' / 'admin
  userInfo.note = userAttr.note
  userInfo.subscribe = userAttr.subscribe
  userInfo.roles = roles;

  return userInfo
}

export function constructRoleInfo(leanRole, permissions=undefined) {
  if(!leanRole) {
    return undefined;
  }

  const roleAttr = leanRole.attributes;
  if(!roleAttr) {
    return undefined;
  }

  const roleInfo = {};
  roleInfo.id = leanRole.id;
  roleInfo.code = roleAttr.code;
  roleInfo.displayName = roleAttr.displayName;
  roleInfo.permissions = permissions;

  return roleInfo;
}

export function constructPermissionInfo(leanPerm) {
  if(!leanPerm) {
    return undefined;
  }

  const permAttr = leanPerm.attributes;
  if(!permAttr) {
    return undefined;
  }

  const permInfo = {};
  permInfo.id = leanPerm.id;
  permInfo.code = permAttr.code;
  permInfo.displayName = permAttr.displayName;

  return permInfo;
}

async function authGetRolesByUser(userId) {
  const ptrUser = AV.Object.createWithoutData('_User', userId);

  const query = new AV.Query('User_Role_Map');
  query.equalTo('user', ptrUser);
  query.include(['role']);

  const leanUserRolePairs = await query.find();

  const roles = [];
  leanUserRolePairs.forEach((i) => {
    // TODO: permissions associated with the role?
    roles.push(constructRoleInfo(i.get('role')));
  });

  return roles;
}

async function authGetPermissionsByUser(userId) {
  const roles = authGetRolesByUser(userId);

  const leanPermissionsById = new Map();

  // get permissions for each role
  await Promise.all(roles.map(
    async (i) => {
      const ptrRole = AV.Object.createWithoutData('_Role', i.id);
      const query = new AV.Query('Role_Permission_Map');
      query.equalTo('role', ptrRole);
      query.include(['permission']);
      // TODO: limit

      const leanRolePermissionPairs = await query.find();

      leanRolePermissionPairs.forEach((i) => {
        const leanPermission = i.get('permission');

        leanPermissionsById.set(leanPermission.id, leanPermission);
      });
    }
  ));

  const permissions = [];
  for (const i of leanPermissionsById.values()) {
    permissions.push(constructPermissionInfo(i));
  }

  return permissions;
}

function isUserSignIn(openid) {
  var query = new AV.Query('_User')
  query.equalTo("authData.weixin.openid", openid)
  return query.first().then((result) => {
    if(result) {
      return true
    } else {
      return false
    }
  }).catch((error) => {
    throw error
  })
}

function fetchWalletInfo(request, response) {
  var userId = request.params.userId

  PingppFunc.getWalletInfo(userId).then((walletInfo) => {
    response.success(walletInfo)
  }).catch((error) => {
    console.log("fetchWalletInfo", error)
    response.error(error)
  })

}

function fetchDealRecords(request, response) {
  console.log("fetchDealRecords params:", request.params)
  var userId = request.params.userId
  var limit = request.params.limit || 10
  var lastTime = request.params.lastTime

  PingppFunc.getUserDealRecords(userId, limit, lastTime).then((records) => {
    response.success(records)
  }).catch((error) => {
    console.log("fetchDealRecords", error)
    response.error(error)
  })
}

function verifyIdName(request, response) {
  var userId = request.params.userId
  var idName = request.params.idName
  var idNumber = request.params.idNumber

  var user = AV.Object.createWithoutData('_User', userId)

  user.set('idName', idName)
  user.set('idNumber', idNumber)
  user.set('idNameVerified', false)

  user.save().then((leanUser) => {
    var idInfo = {
      userId: leanUser.id,
      idName: leanUser.attributes.idName,
      idNumber: leanUser.attributes.idNumber,
    }
    response.success(idInfo)
  }).catch((error) => {
    console.log("verifyUsername", error)
    response.error(error)
  })
}

async function getUserId(mobilePhoneNumber) {
  let userId = undefined
  let query = new AV.Query('_User')
  query.equalTo('mobilePhoneNumber', mobilePhoneNumber)
  let user = await query.first()
  userId = user? user.id: undefined
  return userId
}

async function getUserInfoById(userId) {
  if(!userId) {
    return undefined
  }
  let user = AV.Object.createWithoutData('_User', userId)
  if(!user) {
    return undefined
  }
  let userInfo = await user.fetch()
  return constructUserInfo(userInfo)
}

async function setUserMobilePhone(request, response) {
  let currentUser = request.currentUser
  let phone = request.params.phone
  let smsCode = request.params.smsCode

  if(!currentUser) {
    response.error(new Error("用户未登录"))
    return
  }
  let result = await AV.Cloud.verifySmsCode(smsCode, phone)
  if(!result) {
    response.error(new Error("无效的短信验证码"))
    return
  }
  currentUser.setMobilePhoneNumber(phone)
  currentUser.set('mobilePhoneVerified', true)

  let user = await currentUser.save()
  let userInfo = await user.fetch()
  response.success(constructUserInfo(userInfo))
}

/**
 * 更新用户微信公众号关注状态
 * @param {String}    openid    用户微信openid
 * @param {Boolean}   subscribe 用户是否关注公众号
 */
async function updateUserSubscribe(openid, subscribe) {
  if(!openid || subscribe == undefined) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  var query = new AV.Query('_User')
  query.equalTo('authData.weixin.openid', openid)

  let user = await query.first()
  if(!user) {
    return undefined
  }
  user.set('subscribe', subscribe)
  let result = await user.save()
  return result
}

async function authFuncTest(request, response) {
  let userId = request.params.userId
  let userInfo = await getUserInfoById(userId)
  response.success(userInfo)
}

var authFunc = {
  constructUserInfo: constructUserInfo,
  authFuncTest: authFuncTest,
  isUserSignIn: isUserSignIn,
  fetchWalletInfo: fetchWalletInfo,
  fetchDealRecords: fetchDealRecords,
  verifyIdName: verifyIdName,
  getUserId: getUserId,
  getUserInfoById: getUserInfoById,
  setUserMobilePhone: setUserMobilePhone,
  updateUserSubscribe: updateUserSubscribe
}

module.exports = authFunc
