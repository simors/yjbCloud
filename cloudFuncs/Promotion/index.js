/**
 * Created by wanpeng on 2017/10/11.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import amqp from 'amqplib'
import Promise from 'bluebird'
import GLOBAL_CONFIG from '../../config'


//营销活动状态
const PROMOTION_STATUS_AWAIT = 0           //等待触发
const PROMOTION_STATUS_UNDERWAY = 1        //进行中
const PROMOTION_STATUS_INVALID = 2         //无效

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

function constructPromotionInfo(promotion, includeCategory, includeUser) {
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
  promotionInfo.stat = promotionAttr.stat
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
 * 新增营销活动
 * 详情请见：
 * Examples:
 * @param request
 */
async function createPromotion(request) {
  const {currentUser, params} = request
  let title = params.title
  let start = params.start
  let end = params.end
  let description = params.description
  let categoryId = params.categoryId
  let region = [].concat(params.region)
  let awards = params.awards

  if(!categoryId || !title || !start || !end || !awards ) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

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
  return constructPromotionInfo(leanPromotion, false, true)
}

/**
 * 获取营销活动类型列表
 * @param request
 */
async function fetchPromotionCategoryList(request) {
  const {currentUser, params} = request

  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let lastCreatedAt = undefined
  let categoryList = []
  let query = new AV.Query('PromotionCategory')
  query.descending('createdAt')
  while (1) {
    if(lastCreatedAt) {
      query.lessThan('createdAt', new Date(lastCreatedAt))
    }
    let categories = await query.find()
    if(categories.length < 1) {
      break
    }
    categories.forEach((category) => {
      categoryList.push(constructCategoryInfo(category))
    })
    lastCreatedAt = categories[categories.length - 1].createdAt.valueOf()
  }
  return categoryList
}

/**
 * 查询营销活动
 * 详情请见：
 * Examples:
 * @param request
 * @param response
 */
async function fetchPromotions(request, response) {
  const {currentUser, params} = request

  let status = params.status
  let start = params.start
  let end = params.end
  let limit = params.limit || 10
  let isRefresh = params.isRefresh || true
  let lastcreatedAt = params.lastcreatedAt

  let query = new AV.Query('Promotion')
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
  fetchPromotionCategoryList: fetchPromotionCategoryList,
}

module.exports = promotionFunc
