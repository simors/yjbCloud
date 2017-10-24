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

//营销活动类型
const PROMOTION_CATEGORY_TYPE_RECHARGE = 1        //充值奖励
const PROMOTION_CATEGORY_TYPE_SCORE = 2           //积分活动
const PROMOTION_CATEGORY_TYPE_REDENVELOPE = 3     //随机红包
const PROMOTION_CATEGORY_TYPE_LOTTERY = 4         //抽奖
const PROMOTION_CATEGORY_TYPE_EXCHANGE_SCORE = 5  //积分兑换

var Promotion = AV.Object.extend('Promotion')
var RechargePromotion = AV.Object.extend('RechargePromotion')

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

function constructRechargePromotionInfo(recharge, includePromotion, includeUser) {
  let constructUserInfo = require('../Auth').constructUserInfo

  if(!recharge) {
    return undefined
  }
  let rechargepromInfo = {}
  let rechargepromAttr = recharge.attributes
  if(!rechargepromAttr) {
    return undefined
  }
  rechargepromInfo.id = recharge.id
  rechargepromInfo.promotionId = rechargepromAttr.promotion.id
  rechargepromInfo.userId = rechargepromAttr.user.id
  rechargepromInfo.recharge = rechargepromAttr.recharge
  rechargepromInfo.award = rechargepromAttr.award
  rechargepromInfo.createdAt = rechargepromAttr.createdAt
  if(includePromotion) {
    rechargepromInfo.promotion = constructPromotionInfo(rechargepromAttr.promotion, false, false)
  }
  if(includeUser) {
    rechargepromInfo.user = constructUserInfo(rechargepromAttr.user)
  }

  return rechargepromInfo
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
  switch (leanCategory.attributes.title) {
    case '充值奖励':
    {
      initStat = {
        participant: 0,       //参与量
        rechargeAmount: 0,    //充值总额
        awardAmount: 0,       //赠送总额
      }
      break
    }
    case '积分活动':
    {
      initStat = {
        participant: 0,       //参与量
      }
      break
    }
    case '随机红包':
    {
      initStat = {
        participant: 0,       //参与量
        winAmount:0,          //中奖总金额
        winCount:0,           //中奖量
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
  let regionQueryA = new AV.Query('Promotion')
  let regionQueryB = new AV.Query('Promotion')
  let statusQuery = new AV.Query('Promotion')
  timeQuery.greaterThan('end', new Date())
  timeQuery.lessThanOrEqualTo('start', new Date())

  regionQueryA.containsAll('region', userRegion)
  regionQueryB.containedIn('region', userRegion)
  let regionQuery = AV.Query.or(regionQueryA, regionQueryB)

  statusQuery.equalTo('disabled', false)

  let query = AV.Query.and(statusQuery, timeQuery, regionQuery)
  query.include('user')
  query.include('category')
  let results = await query.find()
  let promotionList = []
  if(results.length > 0) {
    results.forEach((promotion) => {
      promotionList.push(constructPromotionInfo(promotion, true, true))
    })
  }
  return promotionList
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
 * 增加充值活动记录
 * @param {String} promotionId     活动id
 * @param {String} userId          用户id
 * @param {Number} recharge        充值金额
 * @param {Number} award           赠送金额
 */
async function addRechargePromRecord(promotionId, userId, recharge, award) {
  if(!promotionId || !userId || !recharge || !award) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let rechargePromotion = new RechargePromotion()
  let promotion = AV.Object.createWithoutData('Promotion', promotionId)
  let user = AV.Object.createWithoutData('_User', userId)
  rechargePromotion.set('promotion', promotion)
  rechargePromotion.set('user', user)
  rechargePromotion.set('recharge', Number(recharge))
  rechargePromotion.set('award', Number(award))
  return await rechargePromotion.save()
}

/**
 * 分页查询充值奖励活动记录
 * @param request
 */
async function fetchRechargePromRecord(request) {
  const {currentUser, params} = request
  if(!currentUser) {
    throw new AV.Cloud.Error('用户未登录', {code: errno.EPERM})
  }
  const {promotionId, lastCreatedAt, limit, isRefresh, start, end, mobilePhoneNumber} = params

  if(!promotionId) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }

  let startQuery = new AV.Query('RechargePromotion')
  let endQuery = new AV.Query('RechargePromotion')
  let otherQuery = new AV.Query('RechargePromotion')
  let rechargeRecordList = []

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
      return rechargeRecordList
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
  results.forEach((record) => {
    rechargeRecordList.push(constructRechargePromotionInfo(record, false, true))
  })
  return rechargeRecordList
}

/**
 * 获取营销活动类型
 * @param {String} promotionId  活动id
 */
async function getPromotionCategoryType(promotionId) {
  if(!promotionId) {
    return undefined
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
  let region = promotionAttr.region
  if(region.length === 1 && region[0] != userInfo.province.value) {
    throw new AV.Cloud.Error('没在活动范围', {code: errno.ERROR_PROM_REGION})
  }
  if(region.length === 2 && (region[0] != userInfo.province.value || region[1] != userInfo.city.value)) {
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
      //TODO 检测用户参与次数
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
    return undefined
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
    return undefined
  }

  let query = new AV.Query('Promotion')
  let promotion = await query.get(promotionId)
  if(!promotion) {
    return undefined
  }
  let promotionAttr = promotion.attributes
  let awards = promotionAttr.awards
  let amount = mathjs.round(mathjs.random(Number(awards.awardMax)), 2)  //随机生成红包金额

  await handleRedEnvelopeDeal(promotionId, userId, amount)
  await updateRedEnvelopePromStat(promotionId, amount)
  return amount
}


/**
 * 处理抽奖请求
 * @param {String} promotionId
 * @param {String} userId
 */
async function handleLotteryMessage(promotionId, userId) {

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
  addRechargePromRecord: addRechargePromRecord,
  fetchRechargePromRecord: fetchRechargePromRecord,
  checkPromotionRequest: checkPromotionRequest,
  insertPromotionMessage: insertPromotionMessage,
  handlePromotionMessage: handlePromotionMessage,
}

module.exports = promotionFunc
