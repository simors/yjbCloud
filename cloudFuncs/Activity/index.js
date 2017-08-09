/**
 * Created by wanpeng on 2017/8/7.
 */
var AV = require('leanengine')
var amqp = require('amqplib')
var Promise = require('bluebird')
var redis = require('redis')
var GLOBAL_CONFIG = require('../../config')
var utilFunc = require('../Util')

var Activity = AV.Object.extend('Activity')

//营销活动类型
const LOTTERY = 1         //抽奖
const RED_ENVELOPE = 2    //红包

//营销活动状态
const AWAIT = 0           //等待触发
const UNDERWAY = 1        //进行中
const INVALID = 2         //无效

//redis
const PREFIX = 'activity:'

function constructActivityInfo(activity) {
  var activityInfo = {}

  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  activityInfo.id = activity.id
  activityInfo.name = activity.attributes.name
  activityInfo.start = activity.attributes.start
  activityInfo.end = activity.attributes.end
  activityInfo.pageView = activity.attributes.pageView
  activityInfo.categoryTitle = activity.attributes.category.attributes.title
  activityInfo.constraints = activity.attributes.constraints

  return client.getAsync(PREFIX + activity.id + ':pageView').then((pageView) => {
    activityInfo.pageView = pageView

    return client.scardAsync(PREFIX + activity.id + ':participant')
  }).then((participant) => {
    activityInfo.participant = participant
    return client.getAsync(PREFIX + activity.id + ':awardCount')
  }).then((awardCount) => {
    activityInfo.winner = awardCount

    return activityInfo
  }).catch((error) => {
    throw  error
  }).finally(() => {
    client.quit()
  })
}

/**
 * 新增营销活动
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
function createActivity(request, response) {
  var name = request.params.name
  var startTime = request.params.start
  var endTime = request.params.end
  var description = request.params.description
  var categoryId = request.params.categoryId
  var prizes = request.params.prizes
  var location = [].concat(request.params.location)
  var constraints = request.params.constraints || 1

  var activity = new Activity()
  var activityCategory = AV.Object.createWithoutData('ActivityCategory', categoryId)

  activity.set('name', name)
  activity.set('start', new Date(startTime))
  activity.set('end', new Date(endTime))
  activity.set('description', description)
  activity.set('category', activityCategory)
  activity.set('prizes', prizes)
  activity.set('location', location)
  activity.set('pageView', 0)
  activity.set('participants', 0)  //参与用户量
  activity.set('constraints', constraints)   //每个用户参与次数限制
  activity.set('winner', 0)
  activity.set('status', AWAIT)

  activity.save().then((leanActivity) => {
    constructActivityInfo(leanActivity).then((activityInfo) => {
      response.success(activityInfo)
    })
  }).catch((error) => {
    console.error(error)
    response.error(error)
  })
}

/**
 * 删除营销活动
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
function deleteActivity(request, response) {
  var activityId = request.params.activityId
}

/**
 * 获取营销活动列表
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
function getActivitiesList(request, response) {
  var activities = []

  var location = request.params.location
  var startTime = request.params.start
  var endTime = request.params.end

  var query = new AV.Query('Activity')
  query.include('category')

  if(location) {
    query.containsAll('location', location)
  }
  if(startTime && endTime) {
    query.greaterThan('start', endTime)
    query.lessThan('end', startTime)
  }
  query.find().then((results) => {
    var redisAction = []
    results.forEach((leanActivity) => {
      var constructAction = constructActivityInfo(leanActivity).then((activityInfo) => {
        activities.push(activityInfo)
      })
      redisAction.push(constructAction)
    })
    return Promise.all(redisAction)
  }).then(() => {
    response.success(activities)
  }).catch((error) => {
    console.log(error)
    response.error(error)
  })
}

/**
 * 活动请求入队
 * @param {String} socketId websocketId
 * @param {String} openid 用户openid
 * @param {String} activityId 活动id
 */
function insertActivityMessage(socketId, openid, activityId, activityCategory) {
  var ex = 'lottery'
  var message = {
    openid: openid,
    socketId: socketId,
    activityId: activityId,
    activityCategory: activityCategory
  }

  switch (activityCategory) {
    case LOTTERY:
      ex = 'lottery'
      break
    case RED_ENVELOPE:
      ex = 'redEnvelope'
      break
    default:
      break
  }

  return amqp.connect(GLOBAL_CONFIG.RABBITMQ_URL).then(function(conn) {
    return conn.createChannel().then(function(ch) {
      var ok = ch.assertExchange(ex, 'fanout', {durable: false})

      return ok.then(function() {
        ch.publish(ex, '', Buffer.from(JSON.stringify(message)));
        return ch.close();
      });
    }).finally(function() { conn.close(); });
  }).catch((error) => {
    throw error
  })
}



/**
 * 检查活动请求
 * @param {String} activityId 活动id
 * @param {String} openid 用户openid
 */
function checkActivityRequest(activityId, openid) {
  var participated = 0 //用户已经参与活动次数

  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  var query = new AV.Query('Activity')
  query.include('category')

  return client.hmgetAsync(PREFIX + activityId + ':participant', openid).then((result) => {
    if (result) {
      participated = result
    }
    return query.get(activityId)
  }).then((leanActivity) => {
    var activityInfo = leanActivity.attributes
    var categoryInfo = activityInfo.category.attributes

    // //活动记录检测
    // if(participated >= activityInfo.constraints) {
    //   return({
    //     pass: false,
    //     message: "您已经参与过此次活动"
    //   })
    // }
    //
    // //活动状态检测
    // if(activityInfo.status === INVALID) {
    //   return({
    //     pass: false,
    //     message: "活动已经失效"
    //   })
    // }
    // //活动有效期检测
    // if(activityInfo.start.valueOf() > Date.now()) {
    //   return({
    //     pass: false,
    //     message: "活动尚未开始，敬请期待！"
    //   })
    // }
    // if(activityInfo.end.valueOf() < Date.now()) {
    //   return({
    //     pass: false,
    //     message: "活动已经结束，感觉您的关注"
    //   })
    // }
    //todo 活动区域检测(从user信息表获取用户区域信息)
    // if(activityInfo.location.indexOf(city) === -1) {
    //   return({
    //     pass: false,
    //     message: "非常抱歉！您所在区域不在此次活动范围内。"
    //   })
    // }

    return({
      pass: true,
      activityCategory: categoryInfo.activityCategoryId
    })
  }).catch((error) => {
    throw error
  }).finally(() => {
    client.quit()
  })
}

/**
 * 处理活动请求
 * @param {String} activityId 活动id
 * @param {Number} activityCategory 活动类型
 * @param {String} openid 用户openid
 */
function handleActivityMessage(activityId, activityCategory, openid) {
  switch (activityCategory) {
    case LOTTERY:
      return handleLotteryMessage(activityId, openid).then((result) => {
        var award = result
        return updateLotteryStatus(activityId, openid, award)
      }).catch((error) => {
        throw error
      })
      break
    case RED_ENVELOPE:
      return handleRedEnvelopeMessage(activityId, openid).then((result) => {
        var award = Number(result)
        return updateRedEnvelopeStatus(activityId, openid, award)
      }).catch((error) => {
        throw error
      })
      break
    default:
      break
  }
}

/**
 * 处理抽奖请求
 * @param {String} activityId 活动id
 * @param {String} openid 用户openid
 */
function handleLotteryMessage(activityId, openid) {
  var random = Math.random()
  var award = undefined

  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  var query = new AV.Query('Activity')
  query.include('category')

  return query.get(activityId).then((leanActivity) => {
    var activityInfo = leanActivity.attributes
    var prizes = activityInfo.prizes
    var tmp = 0
    prizes.forEach((prize) => {
      if(random > tmp && random <= (prize.probability + tmp)) {
        award = prize
      }
      tmp = tmp + prize.probability
    })
    return award
  }).then(() => {
    return client.scardAsync(PREFIX + activityId + ':awardRecord:' + award.id)
  }).then((result) => {
    client.quit()
    if(result < award.total) {
      return award
    } else {
      return undefined
    }
  }).catch((err) => {
    client.quit()
    throw  err
  })
}

/**
 * 处理红包请求
 * @param {String} activityId 活动id
 * @param {String} openid 用户openid
 */
function handleRedEnvelopeMessage(activityId, openid) {
  var award = 0
  var prizeInfo = undefined

  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  var query = new AV.Query('Activity')
  query.include('category')

  return query.get(activityId).then((leanActivity) => {
    var activityInfo = leanActivity.attributes
    prizeInfo = activityInfo.prizes

    award = utilFunc.getRandomArbitrary(0, prizeInfo.maximum).toFixed(2)
    return undefined
  }).then(() => {
    return client.getAsync(PREFIX + activityId + ':awardAmount')
  }).then((awardAmount) => {
    client.quit()
    if((prizeInfo.sum - awardAmount - award) >= 0) {
      return award
    } else {
      return 0
    }
  }).catch((error) => {
    client.quit()
    throw error
  })
}


/**
 * 更新活动页面点击量
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
function incrActivityPageView(request, response) {
  var activityId = request.params.activityId

  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    response.error(err)
  })

  client.incrAsync(PREFIX + activityId + ':pageView').then(() => {

    response.success()
  }).finally(() => {
    client.quit()
  })
}


/**
 * 更新redis上的抽奖活动状态
 * @param {String} activityId 活动id
 * @param {Number} openid 用户openid
 * @param {Object} award 抽奖信息
 */
function updateLotteryStatus(activityId, openid, award) {
  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })


  return client.hincrbyAsync(PREFIX + activityId + ':participant', openid, 1).then(() => {
    if(award) {
      return client.saddAsync(PREFIX + activityId + ':awardRecord:' + award.id, openid).then((result) => {
        return client.incrAsync(PREFIX + activityId + ':awardCount')
      }).then(() => {
        return award
      })
    } else {
      return Promise.resolve()
    }
  }).catch((error) => {
    throw error
  }).finally(() => {
    client.quit()
  })
}

/**
 * 更新redis上的随机红包活动状态
 * @param {String} activityId 活动id
 * @param {Number} openid 用户openid
 * @param {Object} award 抽奖信息
 */
function updateRedEnvelopeStatus(activityId, openid, award) {
  var updateAction = []

  Promise.promisifyAll(redis.RedisClient.prototype)
  var client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  var updateParticipantAction = client.hincrbyAsync(PREFIX + activityId + ':participant', openid, 1)
  var updateAwardsAction = client.incrbyfloatAsync(PREFIX + activityId + ':awardAmount', award)
  var updateAwardCount = client.incrAsync(PREFIX + activityId + ':awardCount')
  var updateAwardRecord = client.hsetAsync(PREFIX + activityId + ':awardRecord', openid, award)
  if(award > 0) {
    updateAction.push(updateParticipantAction, updateAwardsAction, updateAwardCount, updateAwardRecord)
  } else {
    updateAction.push(updateParticipantAction)
  }

  return Promise.all(updateAction).then(() => {
    return award
  }).catch((error) => {
    throw error
  }).finally(() => {
    client.quit()
  })
}

var activityFunc = {
  createActivity: createActivity,
  deleteActivity: deleteActivity,
  getActivitiesList: getActivitiesList,
  insertActivityMessage: insertActivityMessage,
  checkActivityRequest: checkActivityRequest,
  handleActivityMessage: handleActivityMessage,
  incrActivityPageView: incrActivityPageView,
}

module.exports = activityFunc