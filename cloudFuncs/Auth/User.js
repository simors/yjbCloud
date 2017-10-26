import AV from 'leanengine';
import * as errno from '../errno';
import {constructUserInfo, constructRoleInfo, constructPermissionInfo, constructMpAuthData} from './index';
import authFunc from './index'
import utilFunc from '../Util'
import mpAuthFuncs from '../../mpFuncs/Auth'

// --- enum

export const AUTH_USER_TYPE = {
  END:      1,
  ADMIN:    2,
  BOTH:     3,
};

export const AUTH_USER_STATUS = {
  MP_NORMAL:      1,
  MP_DISABLED:    2,
  MP_ALL:         100,

  ADMIN_NORMAL:   101,
  ADMIN_DISABLED: 102,
  ADMIN_ALL:      200,
};

export const AUTH_ROLE_CODE = {
  PLATFORM_MANAGER:             100,        // 平台管理员
  STATION_MANAGER:              200,        // 服务点管理员
  STATION_INVESTOR:             300,        // 服务点投资人
  STATION_PROVIDER:             400,        // 服务单位
  SYS_MANAGER:                  500,        // 系统管理员
};

async function authGetRolesAndPermissions(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  if (currentUser.attributes.type === AUTH_USER_TYPE.END) {
    // only admin users are allowed to login
    throw new AV.Cloud.Error('User type denied.', {code: errno.EINVAL});
  } else if (currentUser.attributes.status === AUTH_USER_STATUS.ADMIN_DISABLED) {
    // check if this admin user has been disabled
    throw new AV.Cloud.Error('User disabled.', {code: errno.EACCES});
  }

  // to get:
  // 1. all roles, 2. all permissions
  const jsonRoles = [];
  const jsonPermissions = [];

  // all roles
  let query = new AV.Query('_Role');
  query.ascending('code');

  const leanRoles = await query.find();

  // get permissions for each role
  await Promise.all(leanRoles.map(
    async (i) => {
      // get permissions for role
      const query = new AV.Query('Role_Permission_Map');
      query.equalTo('role', i);
      query.include(['permission']);
      // TODO: limit

      const leanRolePermissionPairs = await query.find();

      const permissionCodes = new Set();
      leanRolePermissionPairs.forEach((i) => {
        const permission = constructPermissionInfo(i.get('permission'));
        permissionCodes.add(permission.code);
      });

      jsonRoles.push({
        ...constructRoleInfo(i),
        permissions: permissionCodes,
      });
    }
  ));

  // all permissions
  query = new AV.Query('Permission');
  query.ascending('code');

  const leanPermissions = await query.find();

  leanPermissions.forEach((i) => {
    jsonPermissions.push(constructPermissionInfo(i));
  });

  return {
    jsonRoles,
    jsonPermissions,
  };
}

/**
 * List end users, i.e., which has no user type defined, or has user type of 'both'.
 * @param {object} req
 * params = {
 *   limit?: number,
 *   mobilePhoneNumber?: string,
 *   province?: string,
 *   city?: string,
 *   status?: string, 'disabled'
 * }
 * @returns {Promise.<Array>} an Array of json representation User(s)
 */
async function authListEndUsers(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {skip=0, limit=10, mobilePhoneNumber, province, city, mpStatus} = params;

  const jsonUsers = [];

  const values = [];
  let cql = 'select count(*),* from _User';
  cql += ' where (type is not exists or type=? or type=?)';
  values.push(AUTH_USER_TYPE.END);
  values.push(AUTH_USER_TYPE.BOTH);
  if (mobilePhoneNumber) {
    cql += ' and mobilePhoneNumber=?';
    values.push(mobilePhoneNumber);
  }
  if (province) {
    cql += ' and province.value=?';
    values.push(province);
  }
  if (city) {
    cql += ' and city.value=?';
    values.push(city);
  }
  if (mpStatus) {
    if (mpStatus === AUTH_USER_STATUS.MP_DISABLED) {
      cql += ' and mpStatus=?';
      values.push(AUTH_USER_STATUS.MP_DISABLED);
    } else if (mpStatus === AUTH_USER_STATUS.MP_NORMAL) {
      cql += ' and (mpStatus is not exists or mpStatus=?)';
      values.push(AUTH_USER_STATUS.MP_NORMAL);
    }
  }
  cql += ' limit ?,?';
  values.push(skip);
  values.push(limit);
  cql += ' order by -createdAt';

  const {count, results} = await AV.Query.doCloudQuery(cql, values);

  results.forEach((i) => {
    jsonUsers.push(constructUserInfo(i));
  });

  return {
    count,
    jsonUsers
  };
}

/**
 * List admin users, i.e., which has has user type of 'admin' or 'both'.
 * @param {object} req
 * params = {
 *   limit?: number,
 *   nickname?: string,
 *   mobilePhoneNumber?: string,
 *   roles?: Array<number>, role codes
 *   status?: string, 'disabled'
 * }
 * @returns {Promise.<Array>} an Array of json representation User(s)
 */
async function authListAdminUsers(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {skip=0, limit=10, nickname, mobilePhoneNumber, roles, status} = params;

  const jsonUsers = [];

  const {mobilePhoneNumber: myMobilePhoneNumber} = currentUser.attributes;

  const values = [];
  let cql = 'select count(*),* from _User';
  cql += ' where (type=? or type=?)';
  values.push(AUTH_USER_TYPE.ADMIN);
  values.push(AUTH_USER_TYPE.BOTH);
  // exclude myself
  cql += ' and mobilePhoneNumber!=?';
  values.push(myMobilePhoneNumber);
  if (nickname) {
    cql += ' and nickname=?';
    values.push(nickname);
  }
  if (mobilePhoneNumber) {
    cql += ' and mobilePhoneNumber=?';
    values.push(mobilePhoneNumber);
  }
  if (roles) {
    // match user who has any role in provided array, change 'in' to 'all' to match
    // user who has all roles in provided array
    cql += ' and roles in ?';
    values.push(roles);
  }
  if (status) {
    if (status === AUTH_USER_STATUS.ADMIN_DISABLED) {
      cql += ' and status=?';
      values.push(AUTH_USER_STATUS.ADMIN_DISABLED);
    } else if (status === AUTH_USER_STATUS.ADMIN_NORMAL) {
      cql += ' and (status is not exists or status=?)';
      values.push(AUTH_USER_STATUS.ADMIN_NORMAL);
    }
  }
  cql += ' limit ?,?';
  values.push(skip);
  values.push(limit);
  cql += ' order by -createdAt';

  const {count, results} = await AV.Query.doCloudQuery(cql, values);

  results.forEach((i) => {
    jsonUsers.push(constructUserInfo(i));
  });

  return {
    count,
    jsonUsers
  };
}

/**
 * List system admin users.
 * @param {object} req
 * params = {
 *   limit?: number,
 *   nickname?: string,
 *   mobilePhoneNumber?: string,
 *   status?: string, 'disabled'
 * }
 * @returns {Promise.<Array>} an Array of json representation User(s)
 */
async function authListSysAdminUsers(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {limit=10, nickname, mobilePhoneNumber, status} = params;

  const jsonUsers = [];

  const values = [];
  let cql = 'select * from _User';
  cql += ' where (type=? or type=?)';
  values.push(AUTH_USER_TYPE.ADMIN);
  values.push(AUTH_USER_TYPE.BOTH);
  if (nickname) {
    cql += ' and nickname=?';
    values.push(nickname);
  }
  if (mobilePhoneNumber) {
    cql += ' and mobilePhoneNumber=?';
    values.push(mobilePhoneNumber);
  }
  // match user who has system admin role
  cql += ' and roles in ?';
  values.push([AUTH_ROLE_CODE.SYS_MANAGER]);
  if (status) {
    if (status === AUTH_USER_STATUS.ADMIN_DISABLED) {
      cql += ' and status=?';
      values.push(AUTH_USER_STATUS.ADMIN_DISABLED);
    } else if (status === AUTH_USER_STATUS.ADMIN_NORMAL) {
      cql += ' and (status is not exists or status=?)';
      values.push(AUTH_USER_STATUS.ADMIN_NORMAL);
    }
  }
  cql += ' limit ?';
  values.push(limit);
  cql += ' order by -createdAt';

  const {results} = await AV.Query.doCloudQuery(cql, values);

  results.forEach((i) => {
    jsonUsers.push(constructUserInfo(i));
  });

  return {
    jsonUsers
  };
}

async function authCreateUser(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const jsonUser = {
  };

  ({
    mpStatus: jsonUser.mpStatus,
    status: jsonUser.status,
    email: jsonUser.email,
    mobilePhoneNumber: jsonUser.mobilePhoneNumber,
    authData: jsonUser.authData,
    username: jsonUser.username,  // must be set
    password: jsonUser.password,  // must be set
    nickname: jsonUser.nickname,
    avatar: jsonUser.avatar,
    sex: jsonUser.sex,
    language: jsonUser.language,
    country: jsonUser.country,
    province: jsonUser.province,
    city: jsonUser.city,
    idNumber: jsonUser.idNumber,
    idName: jsonUser.idName,
    type: jsonUser.type,
    note: jsonUser.note,
    subscribe: jsonUser.subscribe,
    roles: jsonUser.roles,
  } = params);

  if (!jsonUser.username) { // TODO: wechat user
    if (jsonUser.mobilePhoneNumber) {
      jsonUser.username = jsonUser.mobilePhoneNumber;
    }
  }

  if (!jsonUser.username || !jsonUser.password) {
    throw new AV.Cloud.Error('Invalid params, username and password must be set', {code: errno.EINVAL});
  }

  // define db table
  const User = AV.Object.extend('_User');

  // check 'mobilePhoneNumber' and 'username' existent
  if (jsonUser.mobilePhoneNumber) {
    const query = new AV.Query('_User');
    query.equalTo('mobilePhoneNumber', jsonUser.mobilePhoneNumber);

    const count = await query.count();
    if (count > 0) {
      throw new AV.Cloud.Error('Invalid params, mobilePhoneNumber already exists', {code: errno.EEXIST});
    }
  }

  const query = new AV.Query('_User');
  query.equalTo('username', jsonUser.username);

  const count = await query.count();
  if (count > 0) {
    throw new AV.Cloud.Error('Invalid params, username already exists', {code: errno.EEXIST});
  }

  // insert into _User
  const user = new User(jsonUser);
  const leanUser = await user.save(null, {fetchWhenSave: true});

  return constructUserInfo(leanUser);
}

async function authDeleteUser(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {id} = params;

  const ptrUser = AV.Object.createWithoutData('_User', id);

  await AV.Object.destroyAll([ptrUser]);

  return {

  };
}

async function authUpdateUser(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const jsonUser = {
  };

  ({
    mpStatus: jsonUser.mpStatus,
    status: jsonUser.status,
    email: jsonUser.email,
    // mobilePhoneNumber: jsonUser.mobilePhoneNumber,
    authData: jsonUser.authData,
    // username: jsonUser.username,
    password: jsonUser.password,
    nickname: jsonUser.nickname,
    avatar: jsonUser.avatar,
    sex: jsonUser.sex,
    language: jsonUser.language,
    country: jsonUser.country,
    province: jsonUser.province,
    city: jsonUser.city,
    idNumber: jsonUser.idNumber,
    idName: jsonUser.idName,
    type: jsonUser.type,
    note: jsonUser.note,
    subscribe: jsonUser.subscribe,
    roles: jsonUser.roles,
  } = params);

  const {id} = params;

  const ptrUser = AV.Object.createWithoutData('_User', id);

  // update _User

  for (const [key, value] of Object.entries(jsonUser)) {
    if (value) {
      ptrUser.set(key, value);
    }
  }

  await ptrUser.save(null, {fetchWhenSave: true});

  return constructUserInfo(ptrUser);
}

async function authFetchUserByPhone(phone) {
  let query = new AV.Query('_User');
  query.equalTo('mobilePhoneNumber', phone);
  return await query.first()
}

async function reqFetchUserByPhone(request) {
  let phone = request.params.phone
  return await authFetchUserByPhone(phone)
}

async function authFetchUserByOpenId(openid) {
  let query = new AV.Query('_User')
  query.equalTo("authData.weixin.openid", openid)
  return await query.first()
}

async function authListOpenIdsTest(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  return await authListOpenIds(params);
}

async function authListOpenIds(params) {

  const {limit=10, lastUpdatedAt, province, city, mpStatus} = params;

  const openIds = [];
  let updatedAt = undefined;

  const values = [];
  let cql = 'select authData from _User';
  cql += ' where authData is exists';
  if (province) {
    cql += ' and province.value=?';
    values.push(province);
  }
  if (city) {
    cql += ' and city.value=?';
    values.push(city);
  }
  if (mpStatus) {
    if (mpStatus === AUTH_USER_STATUS.MP_DISABLED) {
      cql += ' and mpStatus=?';
      values.push(AUTH_USER_STATUS.MP_DISABLED);
    } else if (mpStatus === AUTH_USER_STATUS.MP_NORMAL) {
      cql += ' and (mpStatus is not exists or mpStatus=?)';
      values.push(AUTH_USER_STATUS.MP_NORMAL);
    }
  }
  if (lastUpdatedAt) {
    cql += ' and updatedAt<date(?)';
    values.push(lastUpdatedAt);
  }
  cql += ' limit ?';
  values.push(limit);
  cql += ' order by -updatedAt';

  const {results} = await AV.Query.doCloudQuery(cql, values);

  results.forEach((i) => {
    const authData = constructMpAuthData(i);
    openIds.push(authData.openid);
    updatedAt = i.updatedAt;
  });

  return {
    openIds,
    lastUpdatedAt: updatedAt
  };
}

const authApi = {
  AUTH_USER_TYPE,
  AUTH_USER_STATUS,
  authGetRolesAndPermissions,
  authListEndUsers,
  authListAdminUsers,
  authListSysAdminUsers,
  authCreateUser,
  authDeleteUser,
  authUpdateUser,
  authFetchUserByPhone,
  reqFetchUserByPhone,
  authFetchUserByOpenId,
  authListOpenIds,
  authListOpenIdsTest,
};

module.exports = authApi;
