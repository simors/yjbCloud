import AV from 'leanengine';
import * as errno from '../errno';

async function authFetchRolesAndPermissions(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  // TODO: limit

  // to get:
  // 1. roles for current user, 2. all roles, 3. all permissions
  const jsonActiveRoleIds = [];
  const jsonAllRoles = [];
  const jsonAllPermissions = [];

  // roles for current user
  let query = new AV.Query('User_Role_Map');
  query.equalTo('user', currentUser);
  // query.include(['role']);
  const leanUserRolePairs = await query.find();

  leanUserRolePairs.forEach((i) => {
    const roleId = i.get('role').id;
    jsonActiveRoleIds.push(roleId);
  });

  // all roles
  query = new AV.Query('_Role');
  query.ascending('code');
  const leanAllRoles = await query.find();

  // get permissions for each role
  await Promise.all(leanAllRoles.map(
    async (i) => {
      // get permissions by role
      const ptrRole = AV.Object.createWithoutData('_Role', i.id);
      const query = new AV.Query('Role_Permission_Map');
      query.equalTo('role', ptrRole);
      // query.include(['permission']);
      // TODO: limit

      const permissionIdsPerRole = [];
      const leanRolePermissionPairs = await query.find();
      leanRolePermissionPairs.forEach((i) => {
        const permissionId = i.get('permission').id;
        permissionIdsPerRole.push(permissionId);
      });

      jsonAllRoles.push({
        ...i.toJSON(),
        permissions: permissionIdsPerRole,
      });
    }
  ));

  // all permissions
  query = new AV.Query('Permission');
  query.ascending('code');
  const leanAllPermissions = await query.find();

  leanAllPermissions.forEach((i) => {
    jsonAllPermissions.push(i.toJSON());
  });

  return {
    jsonActiveRoleIds,
    jsonAllRoles,
    jsonAllPermissions,
  };
}

async function authFetchUserList(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  // TODO: filter params

  const users = [];
  const userRolePairs = {};

  // TODO: limit

  const query = new AV.Query('_User');
  query.descending('createdAt');
  query.equalTo('type', 'admin');

  const leanUsers = await query.find();

  // get roles for each user
  await Promise.all(leanUsers.map(
    async (leanUser) => {
      const ptrUser = AV.Object.createWithoutData('_User', leanUser.id);

      const query = new AV.Query('User_Role_Map');
      query.equalTo('user', ptrUser);
      // query.include(['role']);

      const leanUserRolePairs = await query.find();

      const roleIdsPerUser = [];
      leanUserRolePairs.forEach((i) => {
        // roles.push(i.get('role').toJSON());
        roleIdsPerUser.push(i.get('role').id);
      });

      userRolePairs[leanUser.id] = roleIdsPerUser;
    }
  ));

  // put outside to keep data items in order
  leanUsers.forEach((i) => {
    users.push({
      ...i.toJSON(),
      roles: userRolePairs[i.id],
    })
  });

  return users;
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
  } = params);

  const {roles} = params;

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
  const UserRoleMap = AV.Object.extend('User_Role_Map');

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

  // create _User and _Role pointer and insert into User_Role_Map
  const userRolePairs = [];

  const ptrUser = AV.Object.createWithoutData('_User', leanUser.id);

  roles.forEach((i) => {
    const ptrRole = AV.Object.createWithoutData('_Role', i);

    const userRolePair = new UserRoleMap({
      user: ptrUser,
      role: ptrRole
    });

    userRolePairs.push(userRolePair);
  });

  await AV.Object.saveAll(userRolePairs);
}

async function authDeleteUser(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {id} = params;

  const ptrUser = AV.Object.createWithoutData('_User', id);

  const query = new AV.Query('User_Role_Map');
  query.equalTo('user', ptrUser);

  const leanUserRolePairs = await query.find();

  const ptrUserRolePairs = [];
  leanUserRolePairs.forEach((i) => {
    const ptrUserRolePair = AV.Object.createWithoutData('User_Role_Map', i.id);

    ptrUserRolePairs.push(ptrUserRolePair);
  });

  await AV.Object.destroyAll([...ptrUserRolePairs, ptrUser]);
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
  } = params);

  const {id, roles} = params;

  // update User_Role_Map

  const ptrUser = AV.Object.createWithoutData('_User', id);

  const query = new AV.Query('User_Role_Map');
  query.equalTo('user', ptrUser);
  // query.include(['role']);

  const leanUserRolePairs = await query.find();

  const oldRoles = [];

  leanUserRolePairs.forEach((i) => {
    oldRoles.push(i.get('role').id);
  });

  const rolesToAdd = [...roles].filter(i => ! new Set(oldRoles).has(i));
  const rolesToRemove = [...oldRoles].filter(i => ! new Set(roles).has(i));

  const ptrUserRolePairsToAdd = [];
  const ptrUserRolePairsToRemove = [];

  rolesToAdd.forEach((i) => {
    const ptrUserRolePair = AV.Object.createWithoutData('User_Role_Map', i);

    ptrUserRolePairsToAdd.push(ptrUserRolePair);
  });

  rolesToRemove.forEach((i) => {
    const ptrUserRolePair = AV.Object.createWithoutData('User_Role_Map', i);

    ptrUserRolePairsToRemove.push(ptrUserRolePair);
  });

  await AV.Object.saveAll(ptrUserRolePairsToAdd);
  await AV.Object.destroyAll(ptrUserRolePairsToRemove);

  // update _User

  for (const [key, value] of Object.entries(jsonUser)) {
    ptrUser.set(key, value);
  }
  await ptrUser.save();
}

const authApi = {
  authFetchRolesAndPermissions,
  authFetchUserList,
  authCreateUser,
  authDeleteUser,
  authUpdateUser,
};

module.exports = authApi;
