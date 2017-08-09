var AV = require('leanengine')
var authFunc = require('./cloudFuncs/Auth')
var activityFunc = require('./cloudFuncs/Activity')


/**
 * 云函数
 */
//用户
AV.Cloud.define('authAuthFuncTest', authFunc.authFuncTest)

//营销活动
AV.Cloud.define('activityIncrActivityPageView', activityFunc.incrActivityPageView)
AV.Cloud.define('activityCreateActivity', activityFunc.createActivity)
AV.Cloud.define('activityDeleteActivity', activityFunc.deleteActivity)
AV.Cloud.define('activityGetActivitiesList', activityFunc.getActivitiesList)

module.exports = AV.Cloud;
