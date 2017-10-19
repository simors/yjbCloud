/**
 * Created by wanpeng on 2017/10/11.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import amqp from 'amqplib'
import Promise from 'bluebird'
import GLOBAL_CONFIG from '../../config'

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
  promotionInfo.disabled = promotionAttr.disabled
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
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
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
  promotion.set('disabled', false)
  promotion.set('awards', awards)
  promotion.set('user', currentUser)

  let result = await promotion.save()
  let leanPromotion = await result.fetch()
  return constructPromotionInfo(leanPromotion, false, true)
}

/**
 * 编辑营销活动
 * @param request
 */
async function editPromotion(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let promotionId = params.promotionId
  if(!promotionId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let title = params.title
  let start = params.start
  let end = params.end
  let description = params.description
  let region = [].concat(params.region)
  let awards = params.awards
  let disabled = params.disabled

  if(!title && !start && !end && !description && region.length == 0 && !awards && disabled === undefined) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  if(!promotion) {
    throw new AV.Cloud.Error('没找到该活动对象', {code: errno.ENODATA})
  }
  let leanPromotion = await promotion.fetch()
  if(leanPromotion.attributes.user.id != currentUser.id) {
    throw new AV.Cloud.Error('该用户没有操作权限', {code: errno.EPERM})
  }
  if(title) {
    promotion.set('title', title)
  }
  if(start) {
    promotion.set('start', new Date(start))
  }
  if(end) {
    promotion.set('end', new Date(end))
  }
  if(description) {
    promotion.set('description', description)
  }
  if(region) {
    promotion.set('region', region)
  }
  if(awards) {
    promotion.set('awards', awards)
  }
  if(disabled != undefined) {
    promotion.set('disabled', disabled)
  }

  let result = await promotion.save()
  leanPromotion = await result.fetch()
  return constructPromotionInfo(leanPromotion, false, false)
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
 * 查询营销活动类型列表
 * 备注：无分页查询
 * Examples:
 * @param request
 * @param response
 */
async function fetchPromotions(request) {
  const {currentUser, params} = request

  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  let disabled = params.disabled
  let start = params.start
  let end = params.end
  let lastCreatedAt = undefined
  let promotionList = []

  let query = new AV.Query('Promotion')
  query.descending('createdAt')
  query.include('category')
  query.include('user')

  if(disabled != undefined) {
    query.equalTo('disabled', disabled)
  }
  if(start) {
    query.greaterThanOrEqualTo('createdAt', new Date(start))
  }
  if(end) {
    query.lessThan('createdAt', new Date(end))
  }
  while (1) {
    if(lastCreatedAt) {
      query.lessThan('createdAt', new Date(lastCreatedAt))
    }
    let results = await query.find()
    if(results.length < 1) {
      break
    }
    results.forEach((promotion) => {
      promotionList.push(constructPromotionInfo(promotion, true, true))
    })
    lastCreatedAt = results[results.length - 1].createdAt.valueOf()
  }
  return promotionList
}

var promotionFunc = {
  constructPromotionInfo: constructPromotionInfo,
  createPromotion: createPromotion,
  fetchPromotions: fetchPromotions,
  fetchPromotionCategoryList: fetchPromotionCategoryList,
  editPromotion: editPromotion,
}

module.exports = promotionFunc
