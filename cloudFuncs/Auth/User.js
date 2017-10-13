var AV = require('leanengine');

async function authFetchRolesAndPermissions(req) {
  const leanActiveUser = req.currentUser;

  // TODO: limit

  // to get:
  // 1. roles for current user, 2. all roles, 3. all permissions
  const jsonActiveRoleIds = [];
  const jsonAllRoles = [];
  const jsonAllPermissions = [];

  // roles for current user
  let query = new AV.Query('User_Role_Map');
  query.equalTo('user', leanActiveUser);
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

async function userListFetch(req) {
  const curUser = req.currentUser;
  console.log('fetchUser currentUser: ', currentUser);
  return {};
}

async function createUser(req) {
  return {};
}

async function deleteUser(req) {
  return {};
}

async function updateUser(req) {
  return {};
}

const authApi = {
  authFetchRolesAndPermissions,
  userListFetch,
  createUser,
  deleteUser,
  updateUser,
};

module.exports = authApi;
