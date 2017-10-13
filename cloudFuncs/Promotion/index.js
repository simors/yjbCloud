/**
 * Created by wanpeng on 2017/10/11.
 */
var AV = require('leanengine')
var amqp = require('amqplib')
var Promise = require('bluebird')
var redis = require('redis')
var GLOBAL_CONFIG = require('../../config')
var utilFunc = require('../Util')

//营销活动状态
const PROMOTION_STATUS_AWAIT = 0           //等待触发
const PROMOTION_STATUS_UNDERWAY = 1        //进行中
const PROMOTION_STATUS_INVALID = 2         //无效

//redis
const PREFIX = 'promotion:'
var Promotion = AV.Object.extend('Promotion')

function constructCategoryInfo(category) {
  if(!category) {
    return undefined
  }
  let categoryInfo = {}
  let categoryAttr = category.attributes
  if(!categoryAttr) {
    return undefined
  }
  categoryInfo.id = category.id
  categoryInfo.title = categoryAttr.title
  categoryInfo.description = categoryAttr.description
  categoryInfo.createdAt = category.createdAt

  return categoryInfo
}

async function constructPromotionInfo(promotion, includeCategory, includeUser) {
  let constructUserInfo = require('../Auth').constructUserInfo

  if(!promotion) {
    return undefined
  }
  let promotionInfo = {}
  let promotionAttr = promotion.attributes
  if(!promotionAttr) {
    return undefined
  }
  promotionInfo.id = promotion.id
  promotionInfo.title = promotionAttr.title
  promotionInfo.description = promotionAttr.description
  promotionInfo.start = promotionAttr.start
  promotionInfo.end = promotionAttr.end
  promotionInfo.region = promotionAttr.region
  promotionInfo.status = promotionAttr.status
  promotionInfo.categoryId = promotionAttr.category.id
  promotionInfo.createdAt = promotion.createdAt
  promotionInfo.awards = promotionAttr.awards
  promotionInfo.userId = promotionAttr.user.id
  promotionInfo.stat = await getPromotionStatFromRedis(promotion.id)
  if(includeCategory) {
    promotionInfo.category = constructCategoryInfo(promotionAttr.category)
  }
  if(includeUser) {
    promotionInfo.user = constructUserInfo(promotionAttr.user)
  }

  return promotionInfo
}

async function getCategoryTitle(categoryId) {
  if(!categoryId) {
    return undefined
  }

  let category = AV.Object.createWithoutData('PromotionCategory', categoryId)
  let leanCategory = await category.fetch()
  let title = leanCategory.attributes.title
  return title
}

/**
 * redis上创建活动统计记录
 * @param {String}  promotionId
 * @param {String}  categoryId
 */
async function createPromotionStatToRedis(promotionId, categoryId) {
  let promises = []

  Promise.promisifyAll(redis.RedisClient.prototype)
  let client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  try {
    let categoryTitle = await getCategoryTitle(categoryId)
    let categoryPrommise = client.setAsync(PREFIX + promotionId + ':category', categoryTitle)
    if(categoryTitle == '充值奖励') {
      let participationPromise = client.setAsync(PREFIX + promotionId + ':participation', 0)
      let rechargeAmountPromise = client.setAsync(PREFIX + promotionId + ':rechargeAmount', 0)
      let awardAmountPromise = client.setAsync(PREFIX + promotionId + ':awardAmount', 0)
      promises.push(categoryPrommise, participationPromise, rechargeAmountPromise, awardAmountPromise)
    } else if(categoryTitle == '积分活动') {

    }

    let result = await Promise.all(promises)
    client.quit()
  } catch (error) {
    throw error
  }
}

/**
 * 获取redis上的活动统计记录
 * @param {String}  promotionId
 */
async function getPromotionStatFromRedis(promotionId) {
  let promotionStat = {}
  Promise.promisifyAll(redis.RedisClient.prototype)
  let client = redis.createClient(GLOBAL_CONFIG.REDIS_PORT, GLOBAL_CONFIG.REDIS_URL)
  client.auth(GLOBAL_CONFIG.REDIS_AUTH)
  client.select(GLOBAL_CONFIG.REDIS_DB)
  client.on('error', function (err) {
    throw err
  })

  try {
    let categoryTitle = await client.getAsync(PREFIX + promotionId + ':category')
    if(categoryTitle == '充值奖励') {
      promotionStat.participation = await client.getAsync(PREFIX + promotionId + ':participation')
      promotionStat.rechargeAmount = await client.getAsync(PREFIX + promotionId + ':rechargeAmount')
      promotionStat.awardAmount = await client.getAsync(PREFIX + promotionId + ':awardAmount')
    } else if(categoryTitle == '积分活动') {

    }
    client.quit()
    return promotionStat
  } catch (error) {
    throw error
  }
}

/**
 * 新增营销活动
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
async function createPromotion(request, response) {
  let currentUser = request.currentUser
  let title = request.params.title
  let start = request.params.start
  let end = request.params.end
  let description = request.params.description
  let categoryId = request.params.categoryId
  let region = [].concat(request.params.region)
  let awards = request.params.awards

  if(!categoryId || !title || !start || !end || !awards ) {
    response.error(new Error("参数错误"))
    return
  }

  try {
    let promotion = new Promotion()
    let category = AV.Object.createWithoutData('PromotionCategory', categoryId)

    promotion.set('title', title)
    promotion.set('start', new Date(start))
    promotion.set('end', new Date(end))
    promotion.set('description', description)
    promotion.set('category', category)
    promotion.set('region', region)
    promotion.set('status', PROMOTION_STATUS_AWAIT)
    promotion.set('awards', awards)
    promotion.set('user', currentUser)

    let result = await promotion.save()
    let leanPromotion = await result.fetch()
    await createPromotionStatToRedis(leanPromotion.id, categoryId)
    let promotionInfo = await constructPromotionInfo(leanPromotion, false)
    response.success(promotionInfo)
  } catch (error) {
    console.error(error)
    response.error(error)
  }
}

/**
 * 查询营销活动
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
async function fetchPromotions(request, response) {
  let currentUser = request.currentUser
  let status = request.params.status
  let start = request.params.start
  let end = request.params.end
  let limit = request.params.limit || 10
  let isRefresh = request.params.isRefresh || true
  let lastcreatedAt = request.params.createdAt

  let query = new AV.Query('Order')
  query.include('category')
  query.include('user')
  query.limit(limit)

  if(status != undefined) {
    query.equalTo('status', status)
  }
  if(start) {
    query.greaterThanOrEqualTo('createdAt', new Date(start))
  }

  if(end) {
    query.lessThan('createdAt', new Date(end))
  }

  if(!isRefresh && lastcreatedAt) {
    query.lessThan('createdAt', new Date(lastcreatedAt))
  }
  query.descending('createdAt')

  try {
    let results = await query.find()
    let promotionList = []
    results.forEach((promotion) => {
      promotionList.push(constructPromotionInfo(promotion, true, true))
    })
    response.success(promotionList)
  } catch (error) {
    console.error(error)
    response.error(error)
  }

}

var promotionFunc = {
  constructPromotionInfo: constructPromotionInfo,
  createPromotion: createPromotion,
  fetchPromotions: fetchPromotions,
}

module.exports = promotionFunc
