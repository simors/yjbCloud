/**
 * Created by wanpeng on 2017/10/11.
 */
import AV from 'leanengine'
import * as errno from '../errno'
import amqp from 'amqplib'
import Promise from 'bluebird'
import GLOBAL_CONFIG from '../../config'
import moment from 'moment'
import utilFunc from '../Util'
import mathjs from 'mathjs'
import {recordOperation} from '../OperationLog'

//营销活动类型
const PROMOTION_CATEGORY_TYPE_RECHARGE = 1        //充值奖励
const PROMOTION_CATEGORY_TYPE_SCORE = 2           //积分活动
const PROMOTION_CATEGORY_TYPE_REDENVELOPE = 3     //随机红包
const PROMOTION_CATEGORY_TYPE_LOTTERY = 4         //抽奖
const PROMOTION_CATEGORY_TYPE_EXCHANGE_SCORE = 5  //积分兑换

var Promotion = AV.Object.extend('Promotion')
var PromotionRecord = AV.Object.extend('PromotionRecord')

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
  categoryInfo.type = categoryAttr.type
  categoryInfo.createdAt = category.createdAt

  return categoryInfo
}

function constructPromotionRecordInfo(promotionRecord, includePromotion, includeUser) {
  let constructUserInfo = require('../Auth').constructUserInfo
  if(!promotionRecord) {
    return undefined
  }
  let promotionRecordInfo = {}
  let promotionRecordAttr = promotionRecord.attributes
  if(!promotionRecordAttr) {
    return undefined
  }
  promotionRecordInfo.id = promotionRecord.id
  promotionRecordInfo.promotionId = promotionRecordAttr.promotion.id
  promotionRecordInfo.userId = promotionRecordAttr.user.id
  promotionRecordInfo.metadata = promotionRecordAttr.metadata
  promotionRecordInfo.createdAt = promotionRecord.createdAt
  if(includePromotion) {
    promotionRecordInfo.promotion = constructPromotionInfo(promotionRecordAttr.promotion, false, false)
  }
  if(includeUser) {
    promotionRecordInfo.user = constructUserInfo(promotionRecordAttr.user)
  }
  return promotionRecordInfo
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
  let initStat = {}

  if(!categoryId || !title || !start || !end || !awards ) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let isPromExist = await isPromotionExist(categoryId, start, end, region)
  if(isPromExist) {
    throw new AV.Cloud.Error('重复的活动', {code: errno.ERROR_PROM_REPEAT})
  }

  let promotion = new Promotion()
  let category = AV.Object.createWithoutData('PromotionCategory', categoryId)
  let leanCategory = await category.fetch()
  switch (leanCategory.attributes.type) {
    case PROMOTION_CATEGORY_TYPE_RECHARGE:
    {
      initStat = {
        participant: 0,       //参与量
        rechargeAmount: 0,    //充值总额
        awardAmount: 0,       //赠送总额
      }
      break
    }
    case PROMOTION_CATEGORY_TYPE_SCORE:
    {
      initStat = {
        participant: 0,       //参与量
        scoreAmount: 0,       //赠送积分总数
      }
      break
    }
    case PROMOTION_CATEGORY_TYPE_REDENVELOPE:
    {
      initStat = {
        participant: 0,       //参与量
        winAmount:0,          //中奖总金额
        winCount:0,           //中奖量
      }
      break
    }
    case PROMOTION_CATEGORY_TYPE_EXCHANGE_SCORE:
    {
      initStat = {
        participant: 0,       //参与量
        scoreAmount: 0,       //总兑换积分
      }
      break
    }
    default:

  }

  promotion.set('title', title)
  promotion.set('start', new Date(start))
  promotion.set('end', new Date(end))
  promotion.set('description', description)
  promotion.set('category', category)
  promotion.set('region', region)
  promotion.set('disabled', false)
  promotion.set('awards', awards)
  promotion.set('user', currentUser)
  promotion.set('stat', initStat)

  let result = await promotion.save()
  let leanPromotion = await result.fetch()
  recordOperation(currentUser, "创建营销活动:" + title)
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
  if(disabled === false) {
    let isPromExist = await isPromotionExist(leanPromotion.attributes.category.id, start, end, region)
    if(isPromExist) {
      throw new AV.Cloud.Error('重复的活动', {code: errno.ERROR_PROM_REPEAT})
    }
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
  recordOperation(currentUser, "更新营销活动:" + title)
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
 * 查询营销活动列表
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
  let region = params.region
  let lastCreatedAt = undefined
  let promotionList = []

  let regionQuery = new AV.Query('Promotion')
  if(region && region.length === 1) {
    regionQuery.containsAll('region', region)
  } else if(region && region.length === 2) {
    let regionQueryA = new AV.Query('Promotion')
    let regionQueryB = new AV.Query('Promotion')
    let regionQueryC = new AV.Query('Promotion')
    regionQueryA.containsAll('region', [region[0]])
    regionQueryC.sizeEqualTo('region', 1)
    let regionQueryD = AV.Query.and(regionQueryA, regionQueryC)
    regionQueryB.containsAll('region', region)
    regionQuery = AV.Query.or(regionQueryD, regionQueryB)
  }

  let timeQueryA = new AV.Query('Promotion')
  let timeQueryB = new AV.Query('Promotion')
  let timeQueryC = new AV.Query('Promotion')
  if(start && end) {
    timeQueryA.greaterThan('end', new Date(start))
    timeQueryA.lessThanOrEqualTo('start', new Date(start))
    timeQueryB.greaterThanOrEqualTo('start', new Date(start))
    timeQueryB.lessThan('end', new Date(end))
    timeQueryC.lessThan('start', new Date(end))
    timeQueryC.greaterThan('end', new Date(end))
  }

  let timeQuery = AV.Query.or(timeQueryA, timeQueryB, timeQueryC)

  let otherQuery = new AV.Query('Promotion')
  if(disabled != undefined) {
    otherQuery.equalTo('disabled', disabled)
  }

  let query = AV.Query.and(timeQuery, regionQuery, otherQuery)
  query.descending('createdAt')
  query.include('category')
  query.include('user')

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
/**
 * 判断指定条件内的活动是否存在
 * 备注：同类型的活动在时间和空间上不能重叠
 * @param {String} categoryId  活动类型id
 * @param {String} start       活动开始时间
 * @param {String} end         活动结束时间
 * @param {Array}  region      活动区域
 */
async function isPromotionExist(categoryId, start, end, region) {
  if(!categoryId || !start || !end || !region) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let timeQueryA = new AV.Query('Promotion')
  let timeQueryB = new AV.Query('Promotion')
  let timeQueryC = new AV.Query('Promotion')
  let regionQuery = new AV.Query('Promotion')

  let otherQuery = new AV.Query('Promotion')

  timeQueryA.greaterThan('end', new Date(start))
  timeQueryA.lessThanOrEqualTo('start', new Date(start))
  timeQueryB.greaterThanOrEqualTo('start', new Date(start))
  timeQueryB.lessThan('end', new Date(end))
  timeQueryC.lessThan('start', new Date(end))
  timeQueryC.greaterThan('end', new Date(end))
  let timeQuery = AV.Query.or(timeQueryA, timeQueryB, timeQueryC)

  if(region.length === 1) {
    regionQuery.containsAll('region', region)
  } else if(region.length === 2) {
    let regionQueryA = new AV.Query('Promotion')
    let regionQueryB = new AV.Query('Promotion')
    let regionQueryC = new AV.Query('Promotion')
    regionQueryA.containsAll('region', [region[0]])
    regionQueryC.sizeEqualTo('region', 1)
    let regionQueryD = AV.Query.and(regionQueryA, regionQueryC)
    regionQueryB.containsAll('region', region)
    regionQuery = AV.Query.or(regionQueryD, regionQueryB)
  } else {
    throw new AV.Cloud.Error('活动区域参数错误', {code: errno.EINVAL})
  }

  let category = AV.Object.createWithoutData('PromotionCategory', categoryId)
  otherQuery.equalTo('category', category)
  otherQuery.equalTo('disabled', false)

  let query = AV.Query.and(timeQuery, regionQuery, otherQuery)
  let results = await query.find()
  return results.length > 0? true: false
}
/**
 * 微信端用户查询有效活动列表
 * @param request
 */
async function getValidPromotionList(request) {
  const {currentUser, meta} = request
  const remoteAddress = meta.remoteAddress
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  if(!remoteAddress) {
    throw new AV.Cloud.Error('获取用户ip失败', {code: errno.ERROR_PROM_NOIP})
  }

  let userAddrInfo = await utilFunc.getIpInfo(remoteAddress)
  let userRegion = [userAddrInfo.region_id, userAddrInfo.city_id]
  let timeQuery = new AV.Query('Promotion')
  timeQuery.greaterThan('end', new Date())
  timeQuery.lessThanOrEqualTo('start', new Date())
  timeQuery.equalTo('disabled', false)

  let regionQueryA = new AV.Query('Promotion')
  let regionQueryB = new AV.Query('Promotion')
  let regionQueryC = new AV.Query('Promotion')
  regionQueryA.containsAll('region', [userRegion[0]])
  regionQueryC.sizeEqualTo('region', 1)
  let regionQueryD = AV.Query.and(regionQueryA, regionQueryC)
  regionQueryB.containsAll('region', userRegion)
  let regionQuery = AV.Query.or(regionQueryD, regionQueryB)


  let query = AV.Query.and(timeQuery, regionQuery)
  query.include('user')
  query.include('category')
  let results = await query.find()
  let promotionList = []
  if(results.length > 0) {
    for (let promotion of results) {
      let awards = promotion.attributes.awards
      let userLimit =awards? awards.userLimit : undefined
      let records = await getPromotionRecord(promotion.id, currentUser.id)
      if(!userLimit || records.length < userLimit) {
        promotionList.push(constructPromotionInfo(promotion, true, true))
      }
    }
  }
  return promotionList
}

/**
 * 获取当前用户积分活动
 * @param     {String} userId     用户id
 * @returns   {Promise.<Object>}  promotion
 */
async function getValidScoreProm(userId) {
  if(!userId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let user = AV.Object.createWithoutData('_User', userId)
  let userInfo = await user.fetch()
  let userAttr = userInfo.attributes

  let categoryQuery = new AV.Query('PromotionCategory')
  categoryQuery.equalTo('type', PROMOTION_CATEGORY_TYPE_SCORE)
  let category = await categoryQuery.first()

  let userRegion = [userAttr.province.value, userAttr.city.value]
  let timeQuery = new AV.Query('Promotion')
  let statusQuery = new AV.Query('Promotion')
  timeQuery.greaterThan('end', new Date())
  timeQuery.lessThanOrEqualTo('start', new Date())

  let regionQueryA = new AV.Query('Promotion')
  let regionQueryB = new AV.Query('Promotion')
  let regionQueryC = new AV.Query('Promotion')
  regionQueryA.containsAll('region', [userRegion[0]])
  regionQueryC.sizeEqualTo('region', 1)
  let regionQueryD = AV.Query.and(regionQueryA, regionQueryC)
  regionQueryB.containsAll('region', userRegion)
  let regionQuery = AV.Query.or(regionQueryD, regionQueryB)

  statusQuery.equalTo('disabled', false)
  statusQuery.equalTo('category', category)

  let query = AV.Query.and(statusQuery, timeQuery, regionQuery)
  query.include('user')

  let promotion = await query.first()
  if(!promotion) {
    return undefined
  }
  return constructPromotionInfo(promotion, false, false)
}

/**
 * 更新充值奖励活动统计数据
 * @param {String} promotionId     活动id
 * @param {Number} recharge        充值金额
 * @param {Number} award           赠送金额
 */
async function updateRechargePromStat(promotionId, recharge, award) {
  if(!promotionId || !recharge || !award) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  if(!promotion) {
    throw new AV.Cloud.Error('没找到该活动对象', {code: errno.ENODATA})
  }
  let leanPromotion = await promotion.fetch()
  let stat = leanPromotion.attributes.stat
  stat.participant = stat.participant + 1
  stat.rechargeAmount = mathjs.chain(stat.rechargeAmount).add(recharge).done()
  stat.awardAmount = mathjs.chain(stat.awardAmount).add(award).done()
  leanPromotion.set('stat', stat)
  let result = await leanPromotion.save()
  return result
}

/**
 * 更新随机红包统计数据
 * @param {String} promotionId     活动id
 * @param {Number} amount          中奖金额
 */
async function updateRedEnvelopePromStat(promotionId, amount) {
  if(!promotionId || !amount) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  if(!promotion) {
    throw new AV.Cloud.Error('没找到该活动对象', {code: errno.ENODATA})
  }
  let leanPromotion = await promotion.fetch()
  let stat = leanPromotion.attributes.stat
  stat.participant = stat.participant + 1
  stat.winAmount = stat.winAmount + amount
  stat.winCount = stat.winCount + 1
  leanPromotion.set('stat', stat)
  let result = await leanPromotion.save()
  return result
}

/**
 * 更新积分兑换活动&积分倍率活动统计数据
 * @param promotionId
 * @param scores
 */
async function updateScorePromState(promotionId, scores) {
  if(!promotionId || !scores) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  if(!promotion) {
    throw new AV.Cloud.Error('没找到该活动对象', {code: errno.ENODATA})
  }
  let leanPromotion = await promotion.fetch()
  let stat = leanPromotion.attributes.stat
  stat.participant = stat.participant + 1
  stat.scoreAmount = stat.scoreAmount + mathjs.abs(scores)
  leanPromotion.set('stat', stat)
  let result = await leanPromotion.save()
  return result
}

/**
 * 增加活动记录
 * @param {String} promotionId     活动id
 * @param {String} userId          用户id
 * @param {Object} metadata        活动数据
 */
async function addPromotionRecord(promotionId, userId, metadata) {
  if(!promotionId || !userId || !metadata) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let promotionRecord = new PromotionRecord()
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  let user = AV.Object.createWithoutData('_User', userId)
  promotionRecord.set('promotion', promotion)
  promotionRecord.set('user', user)
  promotionRecord.set('metadata', metadata)
  return await promotionRecord.save()
}

// /**
//  * 分页查询充值奖励活动记录
//  * @param request
//  */
// async function fetchRechargePromRecord(request) {
//   const {currentUser, params} = request
//   if(!currentUser) {
//     throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
//   }
//   const {promotionId, lastCreatedAt, limit, isRefresh, start, end, mobilePhoneNumber} = params
//
//   if(!promotionId) {
//     throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
//   }
//
//   let startQuery = new AV.Query('RechargePromotion')
//   let endQuery = new AV.Query('RechargePromotion')
//   let otherQuery = new AV.Query('RechargePromotion')
//   let rechargeRecordList = []
//
//   if(start) {
//     startQuery.greaterThanOrEqualTo('createdAt', new Date(start))
//   }
//   if(end) {
//     endQuery.lessThan('createdAt', new Date(end))
//   }
//   if(!isRefresh && lastCreatedAt) {
//     otherQuery.lessThan('createdAt', new Date(lastCreatedAt))
//   }
//   if(mobilePhoneNumber) {
//     let userQuery = new AV.Query('_User')
//     userQuery.equalTo('mobilePhoneNumber', mobilePhoneNumber)
//     let user = await userQuery.first()
//     if(!user) {
//       return rechargeRecordList
//     }
//     otherQuery.equalTo('user', user)
//   }
//   let promotion = AV.Object.createWithoutData('Promotion', promotionId)
//   otherQuery.equalTo('promotion', promotion)
//
//   let query = AV.Query.and(startQuery, endQuery, otherQuery)
//   query.include('user')
//   query.limit(limit || 10)
//   query.descending('createdAt')
//
//   let results = await query.find()
//   results.forEach((record) => {
//     rechargeRecordList.push(constructRechargePromotionInfo(record, false, true))
//   })
//   return rechargeRecordList
// }

/**
 * 分页查询活动记录
 * @param request
 */
async function fetchPromotionRecord(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  const {promotionId, lastCreatedAt, limit, isRefresh, start, end, mobilePhoneNumber} = params

  if(!promotionId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let startQuery = new AV.Query('PromotionRecord')
  let endQuery = new AV.Query('PromotionRecord')
  let otherQuery = new AV.Query('PromotionRecord')
  let promotionRecordList = []

  if(start) {
    startQuery.greaterThanOrEqualTo('createdAt', new Date(start))
  }
  if(end) {
    endQuery.lessThan('createdAt', new Date(end))
  }
  if(!isRefresh && lastCreatedAt) {
    otherQuery.lessThan('createdAt', new Date(lastCreatedAt))
  }
  if(mobilePhoneNumber) {
    let userQuery = new AV.Query('_User')
    userQuery.equalTo('mobilePhoneNumber', mobilePhoneNumber)
    let user = await userQuery.first()
    if(!user) {
      return promotionRecordList
    }
    otherQuery.equalTo('user', user)
  }
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  otherQuery.equalTo('promotion', promotion)

  let query = AV.Query.and(startQuery, endQuery, otherQuery)
  query.include('user')
  query.limit(limit || 10)
  query.descending('createdAt')

  let results = await query.find()
  let total = await query.count()
  results.forEach((promotionRecord) => {
    promotionRecordList.push(constructPromotionRecordInfo(promotionRecord, false, true))
  })
  return {total: total, promotionRecordList: promotionRecordList}
}

/**
 * 获取用户参与活动记录
 * @param {String} promotionId
 * @param {String} userId
 */
async function getPromotionRecord(promotionId, userId) {
  if(!userId || !promotionId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  let user = AV.Object.createWithoutData('_User', userId)
  let query = new AV.Query('PromotionRecord')
  query.equalTo('promotion', promotion)
  query.equalTo('user', user)
  let results = await query.find()
  let recordList = []
  results.forEach((record) => {
    recordList.push(constructPromotionRecordInfo(record, false, false))
  })
  return recordList
}

/**
 * 获取营销活动类型
 * @param {String} promotionId  活动id
 */
async function getPromotionCategoryType(promotionId) {
  if(!promotionId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let query = new AV.Query('Promotion')
  query.include('category')
  let promotionInfo = await query.get(promotionId)
  if(!promotionInfo) {
    return undefined
  }
  let categoryInfo = promotionInfo.attributes.category
  return categoryInfo.attributes.type
}

/**
 * 检查活动请求
 * @param {String} promotionId  活动id
 * @param {String} userId       用户id
 */
async function checkPromotionRequest(promotionId, userId) {
  if(!promotionId || !userId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let query = new AV.Query('Promotion')
  query.include('category')
  let promtion = await query.get(promotionId)

  if(!promtion) {
    throw new AV.Cloud.Error('没有找到活动对象', {code: errno.ENODATA})
  }
  let promotionAttr = promtion.attributes
  //活动使能状态
  if(promotionAttr.disabled) {
    throw new AV.Cloud.Error('活动处于禁用状态', {code: errno.ERROR_PROM_DISABLED})
  }
  //活动时间有效期
  if(moment().isBefore(new Date(promotionAttr.start)) || moment().isAfter(new Date(promotionAttr.end))) {
    throw new AV.Cloud.Error('没在活动时间内', {code: errno.ERROR_PROM_TIME})
  }

  //活动区域
  let user = AV.Object.createWithoutData('_User', userId)
  let userInfo = await user.fetch()
  let userAttr = userInfo.attributes
  let region = promotionAttr.region
  if(region.length === 1 && region[0] != userAttr.province.value) {
    throw new AV.Cloud.Error('没在活动范围', {code: errno.ERROR_PROM_REGION})
  }
  if(region.length === 2 && (region[0] != userAttr.province.value || region[1] != userAttr.city.value)) {
    throw new AV.Cloud.Error('没在活动范围', {code: errno.ERROR_PROM_REGION})
  }

  //活动记录检测
  let category = promotionAttr.category
  let stat = promotionAttr.stat
  let awards = promotionAttr.awards
  if(!category) {
    return false
  }
  switch (category.type) {
    case PROMOTION_CATEGORY_TYPE_REDENVELOPE:
    {
      if(mathjs.chain(stat.winAmount).add(awards.awardMax).subtract(awards.awardAmount).done() > 0) {
        throw new AV.Cloud.Error('活动已失效', {code: errno.ERROR_PROM_INVALID})
      }
      if(mathjs.chain(stat.winCount).subtract(awards.count).done() >= 0) {
        throw new AV.Cloud.Error('活动已失效', {code: errno.ERROR_PROM_INVALID})
      }
      let userRecordlist = await getPromotionRecord(promotionId, userId)
      if(userRecordlist.length >= awards.userLimit) {
        throw new AV.Cloud.Error('用户参数次数限制', {code: errno.ERROT_PROM_LIMIT})
      }
      break
    }
    case PROMOTION_CATEGORY_TYPE_LOTTERY:
    {
      break
    }
  }

  return true
}

/**
 * 营销活动请求入队
 * @param {String} socketId
 * @param {String} userId
 * @param {String} promotionId
 */
async function insertPromotionMessage(socketId, userId, promotionId) {
  if(!socketId || !userId || !promotionId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  var ex = 'lottery'
  var message = {
    userId: userId,
    socketId: socketId,
    promotionId: promotionId,
  }
  let categoryType = await getPromotionCategoryType(promotionId)
  switch (categoryType) {
    case PROMOTION_CATEGORY_TYPE_LOTTERY:
      ex = 'lottery'
      break
    case PROMOTION_CATEGORY_TYPE_REDENVELOPE:
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
 * 处理营销活动请求
 * @param {String} promotionId
 * @param {String} userId
 */
async function handlePromotionMessage(promotionId, userId) {
  if(!promotionId || !userId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let categoryType = await getPromotionCategoryType(promotionId)
  switch (categoryType) {
    case PROMOTION_CATEGORY_TYPE_REDENVELOPE:
    {
      return await handleRedEnvelopeMessage(promotionId, userId)
      break
    }
    case PROMOTION_CATEGORY_TYPE_LOTTERY:
    {
      return await handleLotteryMessage(promotionId, userId)
      break
    }
    default:
      break
  }
}

/**
 * 处理随机红包请求
 * @param {String} promotionId
 * @param {String} userId
 */
async function handleRedEnvelopeMessage(promotionId, userId) {
  let handleRedEnvelopeDeal = require('../Pingpp').handleRedEnvelopeDeal
  if(!promotionId || !userId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let query = new AV.Query('Promotion')
  let promotion = await query.get(promotionId)
  if(!promotion) {
    throw new AV.Cloud.Error('没有找到活动对象', {code: errno.ENODATA})
  }
  let promotionAttr = promotion.attributes
  let awards = promotionAttr.awards
  let amount = mathjs.round(mathjs.random(Number(awards.awardMax)), 2)  //随机生成红包金额
  if(amount > 0) {
    await handleRedEnvelopeDeal(promotionId, userId, amount)
  }
  await updateRedEnvelopePromStat(promotionId, amount)
  await addPromotionRecord(promotionId, userId, {amount: amount})
  return amount
}


/**
 * 处理抽奖请求
 * @param {String} promotionId
 * @param {String} userId
 */
async function handleLotteryMessage(promotionId, userId) {

}

/**
 * 获取有效的积分兑换活动
 * @param request
 */
async function getScoreExchangePromotion(request) {
  const {currentUser, meta} = request
  const remoteAddress = meta.remoteAddress
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  if(!remoteAddress) {
    throw new AV.Cloud.Error('获取用户ip失败', {code: errno.ERROR_PROM_NOIP})
  }

  let categoryQuery = new AV.Query('PromotionCategory')
  categoryQuery.equalTo('type', PROMOTION_CATEGORY_TYPE_EXCHANGE_SCORE)
  let category = await categoryQuery.first()

  let userAddrInfo = await utilFunc.getIpInfo(remoteAddress)
  let userRegion = [userAddrInfo.region_id, userAddrInfo.city_id]
  let timeQuery = new AV.Query('Promotion')
  let otherQuery = new AV.Query('Promotion')
  timeQuery.greaterThan('end', new Date())
  timeQuery.lessThanOrEqualTo('start', new Date())

  let regionQueryA = new AV.Query('Promotion')
  let regionQueryB = new AV.Query('Promotion')
  let regionQueryC = new AV.Query('Promotion')
  regionQueryA.containsAll('region', [userRegion[0]])
  regionQueryC.sizeEqualTo('region', 1)
  let regionQueryD = AV.Query.and(regionQueryA, regionQueryC)
  regionQueryB.containsAll('region', userRegion)
  let regionQuery = AV.Query.or(regionQueryD, regionQueryB)

  otherQuery.equalTo('disabled', false)
  otherQuery.equalTo('category', category)

  let query = AV.Query.and(otherQuery, timeQuery, regionQuery)
  query.include('user')
  query.include('category')

  let promotion = await query.first()
  if(!promotion) {
    return undefined
  }
  return constructPromotionInfo(promotion, false, false)
}

/**
 * 积分兑换礼品（积分兑换活动）
 * @param request
 */
async function exchangeGift(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  const {promotionId, giftId, phone, addr} = params
  if(!promotionId || !giftId || !phone || !addr) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let query = new AV.Query('Promotion')
  let promotionInfo = await query.get(promotionId)
  if(!promotionInfo) {
    throw new AV.Cloud.Error('没找到该活动对象', {code: errno.ENODATA})
  }
  let gifts = promotionInfo.attributes.awards.gifts
  let gift = undefined
  gifts.forEach((record) => {
    if(record.id === giftId) {
      gift = record
    }
  })
  if(!gift) {
    throw new AV.Cloud.Error('没找到该活动对象', {code: errno.ENODATA})
  }
  let subtractUserScore = require('../Score').subtractUserScore
  await subtractUserScore(currentUser.id, gift.scores)
  let result = await addPromotionRecord(promotionId, currentUser.id, {
    scores: gift.scores,
    gift: gift.title,
    phone: phone,
    addr: addr})
  await updateScorePromState(promotionId, gift.scores)
  return result
}

async function promotionFuncTest(request) {
  const {currentUser, params} = request
  const {promotionId, userId} = params

  try {
    let result = await handleRedEnvelopeMessage(promotionId, userId)
    return result
  } catch (error) {
    console.error(error)
  }
}

var promotionFunc = {
  promotionFuncTest: promotionFuncTest,
  constructPromotionInfo: constructPromotionInfo,
  createPromotion: createPromotion,
  fetchPromotions: fetchPromotions,
  fetchPromotionCategoryList: fetchPromotionCategoryList,
  editPromotion: editPromotion,
  getValidPromotionList: getValidPromotionList,
  updateRechargePromStat: updateRechargePromStat,
  checkPromotionRequest: checkPromotionRequest,
  insertPromotionMessage: insertPromotionMessage,
  handlePromotionMessage: handlePromotionMessage,
  getValidScoreProm: getValidScoreProm,
  fetchPromotionRecord: fetchPromotionRecord,
  addPromotionRecord: addPromotionRecord,
  getScoreExchangePromotion: getScoreExchangePromotion,
  exchangeGift: exchangeGift,
  updateScorePromState: updateScorePromState,
}

module.exports = promotionFunc
