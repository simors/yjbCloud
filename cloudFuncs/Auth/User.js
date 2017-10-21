import AV from 'leanengine';
import * as errno from '../errno';
import {constructUserInfo, constructRoleInfo, constructPermissionInfo} from './index';

async function authGetRolesAndPermissions(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  // TODO: limit

  // to get:
  // 1. roles for current user, 2. all roles, 3. all permissions
  // const jsonCurRoleCodes = [];
  const jsonRoles = [];
  const jsonPermissions = [];

  // // roles for current user
  // let query = new AV.Query('User_Role_Map');
  // query.equalTo('user', currentUser);
  // query.include(['role']);
  //
  // const leanUserRolePairs = await query.find();
  //
  // leanUserRolePairs.forEach((i) => {
  //   const role = constructRoleInfo(i.get('role'));
  //   const roleCode = role.code;
  //   jsonCurRoleCodes.push(roleCode);
  // });

  // all roles
  let query = new AV.Query('_Role');
  query.ascending('code');

  const leanRoles = await query.find();

  // get permissions for each role
  await Promise.all(leanRoles.map(
    async (i) => {
      // get permissions for role
      // const ptrRole = AV.Object.createWithoutData('_Role', i.id);
      const query = new AV.Query('Role_Permission_Map');
      query.equalTo('role', i);
      query.include(['permission']);
      // TODO: limit

      const leanRolePermissionPairs = await query.find();

      const permissionCodes = new Set();
      leanRolePermissionPairs.forEach((i) => {
        const permission = constructPermissionInfo(i.get('permission'));
        const permissionCode = permission.code;
        permissionCodes.add(permissionCode);
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
    // jsonCurRoleCodes,
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

  const {skip=0, limit=10, mobilePhoneNumber, province, city, status} = params;

  const jsonUsers = [];

  const values = [];
  let cql = 'select count(*),* from _User';
  cql += ' where (type is not exists or type=?)';
  values.push('both');
  if (mobilePhoneNumber) {
    cql += ' and mobilePhoneNumber=?';
    values.push(mobilePhoneNumber);
  }
  if (province) {
    cql += ' and province=?';
    values.push(province);
  }
  if (city) {
    cql += ' and city=?';
    values.push(city);
  }
  if (status) {
    if (status === 'disabled') {
      cql += ' and status=?';
      values.push('disabled');
    } else {
      cql += ' and status!=?';
      values.push('disabled');
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
 *   idName?: string,
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

  const {skip=0, limit=10, idName, mobilePhoneNumber, roles, status} = params;

  const jsonUsers = [];

  const values = [];
  let cql = 'select count(*),* from _User';
  cql += ' where (type=? or type=?)';
  values.push('admin');
  values.push('both');
  if (idName) {
    cql += ' and idName=?';
    values.push(idName);
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
    if (status === 'disabled') {
      cql += ' and status=?';
      values.push('disabled');
    } else {
      cql += ' and status!=?';
      values.push('disabled');
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
 * List end users, i.e., which has no user type defined, or has user type of 'both'.
 * @param {object} req
 * params = {
 *   limit?: number,
 *   lastCreatedAt?: Date,
 *   mobilePhoneNumber?: string,
 *   province?: string,
 *   city?: string,
 *   status?: string, 'disabled'
 * }
 * @returns {Promise.<Array>} an Array of json representation User(s)
 */
async function authListUsers(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  // params = {
  //   limit?,
  //   lastCreatedAt?,
  //   type,                  // 'end' / 'admin',
  //   roleId?,               // valid for type 'admin'
  //   idName?,
  //   mobilePhoneNumber?,
  // }

  const {limit=10, type, roleId, idName, mobilePhoneNumber} = params;
  let {lastCreatedAt} = params;

  const jsonUsers = [];

  const query = new AV.Query('_User');
  query.limit(limit);
  query.descending('createdAt');
  query.equalTo('type', type);
  if (idName)
    query.equalTo('idName', idName);
  if (mobilePhoneNumber)
    query.equalTo('mobilePhoneNumber', mobilePhoneNumber);

  // TODO: for admin user with role filter param
  const total = await query.count();

  let more = true;
  while (more && jsonUsers.length < limit) {
    if (lastCreatedAt)
      query.lessThan('createdAt', lastCreatedAt);

    const leanUsers = await query.find();

    if (leanUsers.length < limit)
      more = false;

    const roleIdsByUser = new Map();
    if (type === 'admin') {
      // get roles for admin user
      await Promise.all(leanUsers.map(
        async (leanUser) => {
          // const ptrUser = AV.Object.createWithoutData('_User', leanUser.id);

          const query = new AV.Query('User_Role_Map');
          query.equalTo('user', leanUser);
          // query.include(['role']);

          const leanUserRolePairs = await query.find();

          const roleIds = new Set();
          leanUserRolePairs.forEach((i) => {
            // roles.push(i.get('role').toJSON());
            roleIds.add(i.get('role').id);
          });

          roleIdsByUser.set(leanUser.id, roleIds);
        }
      ));
    }

    // put outside to keep data items in order
    for (const i of leanUsers) {
      lastCreatedAt = i.createdAt;

      if (roleId && !roleIdsByUser.get(i.id).has(roleId)) // admin w/o the specified role
        continue;

      jsonUsers.push({
        ...constructUserInfo(i),
        roles: roleIdsByUser.get(i.id),
      });

      if (jsonUsers.length >= limit)
        break;
    }
  }

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

  // const {roles} = params;

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
  // const UserRoleMap = AV.Object.extend('User_Role_Map');

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
  const leanUser = await user.save();

  // // create _User and _Role pointer and insert into User_Role_Map
  // const leanUserRolePairs = [];
  //
  // // const ptrUser = AV.Object.createWithoutData('_User', leanUser.id);
  //
  // roles.forEach((i) => {
  //   const ptrRole = AV.Object.createWithoutData('_Role', i);
  //
  //   const leanUserRolePair = new UserRoleMap({
  //     user: leanUser,
  //     role: ptrRole
  //   });
  //
  //   leanUserRolePairs.push(leanUserRolePair);
  // });
  //
  // await AV.Object.saveAll(leanUserRolePairs);

  return {

  };
}

async function authDeleteUser(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {id} = params;

  const ptrUser = AV.Object.createWithoutData('_User', id);

  // const query = new AV.Query('User_Role_Map');
  // query.equalTo('user', ptrUser);
  //
  // const leanUserRolePairs = await query.find();
  //
  // const ptrUserRolePairs = [];
  // leanUserRolePairs.forEach((i) => {
  //   const ptrUserRolePair = AV.Object.createWithoutData('User_Role_Map', i.id);
  //
  //   ptrUserRolePairs.push(ptrUserRolePair);
  // });

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
    state: jsonUser.state,
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

  // update User_Role_Map

  const ptrUser = AV.Object.createWithoutData('_User', id);

  // const query = new AV.Query('User_Role_Map');
  // query.equalTo('user', ptrUser);
  // query.include(['role']);

  // const leanUserRolePairs = await query.find();
  //
  // const oldRoleIds = new Set();
  // leanUserRolePairs.forEach((i) => {
  //   oldRoleIds.add(i.get('role').id);
  // });
  //
  // const newRoleIds = new Set(roles);
  //
  // const roleIdsToAdd = new Set([...newRoleIds].filter(i => !oldRoleIds.has(i)));
  // const roleIdsToRemove = new Set([...oldRoleIds].filter(i => !newRoleIds.has(i)));
  //
  // const leanUserRolePairsToAdd = [];
  // const leanUserRolePairsToRemove = [];
  //
  // const UserRoleMap = AV.Object.extend('User_Role_Map');
  //
  // roleIdsToAdd.forEach((i) => {
  //   const ptrRole = AV.Object.createWithoutData('_Role', i);
  //
  //   const leanUserRolePair = new UserRoleMap({
  //     user: ptrUser,
  //     role: ptrRole
  //   });
  //
  //   leanUserRolePairsToAdd.push(leanUserRolePair);
  // });
  //
  //
  // if (roleIdsToRemove.size > 0) {
  //   leanUserRolePairs.forEach((i) => {
  //     if (roleIdsToRemove.has(i.get('role').id)) {
  //       leanUserRolePairsToRemove.push(i);
  //     }
  //   });
  // }
  //
  // await AV.Object.saveAll(leanUserRolePairsToAdd);
  // await AV.Object.destroyAll(leanUserRolePairsToRemove);

  // update _User

  for (const [key, value] of Object.entries(jsonUser)) {
    ptrUser.set(key, value);
  }

  await ptrUser.save();

  return {

  };
}

const authApi = {
  authGetRolesAndPermissions,
  authListEndUsers,
  authListAdminUsers,
  authListUsers,
  authCreateUser,
  authDeleteUser,
  authUpdateUser,
};

module.exports = authApi;
