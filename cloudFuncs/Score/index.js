/**
 * Created by wanpeng on 2017/10/25.
 */
import * as errno from '../errno'
import AV from 'leanengine'
import mathjs from 'mathjs'

//积分操作类型
const SCORE_OP_TYPE_FOCUS      = 'FOCUS_MP'           //关注微信公众号
const SCORE_OP_TYPE_DEPOSIT    = 'DEPOSIT'            //交押金
const SCORE_OP_TYPE_RECHARGE   = 'RECHARGE'           //充值
const SCORE_OP_TYPE_SERVICE    = 'SERVICE'            //使用干衣柜服务
const SCORE_OP_TYPE_BIND_PHONE = 'BIND_PHONE'         //绑定手机号码
const SCORE_OP_TYPE_ID_AUTH    = 'ID_AUTH'            //实名认证
const SCORE_OP_TYPE_EXCHANGE   = 'EXCHANGE'           //积分兑换

const OP_SCORE = {
  FOCUS_MP:   20,         //关注微信公众号赠送20积分
  DEPOSIT:    20,         //交押金赠送20积分
  RECHARGE:    1,         //充值1元获得1个积分
  SERVICE:     1,         //使用干衣柜服务1次获得1个积分
  BIND_PHONE: 10,         //绑定手机号码赠送10个积分
  ID_AUTH:    20,         //实名认证赠送20个积分
}

/**
 * 更新用户积分
 * @param {String} userId       用户id
 * @param {String} type         积分操作类型
 * @param {Object} metadata     操作数据
 */
async function updateUserScore(userId, type, metadata) {
  let getValidPromotion = require('../Promotion').getValidPromotion
  let addPromotionRecord = require('../Promotion').addPromotionRecord
  let updateScorePromState = require('../Promotion').updateScorePromState
  const PROMOTION_CATEGORY_TYPE_SCORE = require('../Promotion'.PROMOTION_CATEGORY_TYPE_SCORE)
  if(!userId || !type) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let user = AV.Object.createWithoutData('_User', userId)
  if(!user) {
    throw new AV.Cloud.Error('没找到该用户', {code: errno.ENODATA})
  }
  let promotion = await getValidPromotion(userId, PROMOTION_CATEGORY_TYPE_SCORE)
  let rate = 1
  let incrScore = 0
  if(promotion) {
    rate = promotion.awards.rate
  }
  let userInfo = await user.fetch()
  let score = userInfo.attributes.score
  switch (type) {
    case SCORE_OP_TYPE_FOCUS:
    case SCORE_OP_TYPE_DEPOSIT:
    case SCORE_OP_TYPE_SERVICE:
    case SCORE_OP_TYPE_BIND_PHONE:
    case SCORE_OP_TYPE_ID_AUTH:
      incrScore = mathjs.chain(OP_SCORE[type]).multiply(rate).done()
      break
    case SCORE_OP_TYPE_RECHARGE:
      let recharge = metadata.recharge || 0
      incrScore = mathjs.chain(OP_SCORE[type]).multiply(recharge).multiply(rate).done()
      break
    default:
      break
  }

  score = mathjs.chain(score).add(incrScore).done()
  user.set('score', score)
  let result = await user.save()
  if(promotion && result) {
    await addPromotionRecord(promotion.id, userId, {score: incrScore, type: type})
    await updateScorePromState(promotion.id, incrScore)
  }
  return result
}

/**
 * 扣除用户积分（积分兑换活动）
 * @param {String} userId       用户id
 * @param {Number} scores       消费积分
 */
async function subtractUserScore(userId, scores) {
  if(!userId || !scores) {
    throw new AV.Cloud.Error('参数错误', {code: errno.EINVAL})
  }
  let user = AV.Object.createWithoutData('_User', userId)
  if(!user) {
    throw new AV.Cloud.Error('没找到该用户', {code: errno.ENODATA})
  }
  let userInfo = await user.fetch()
  let score = userInfo.attributes.score
  score = mathjs.chain(score).subtract(scores).done()
  if(score < 0) {
    throw new AV.Cloud.Error('积分不足', {code: errno.ERROR_PROM_NOSCORE})
  }
  user.set('score', score)
  return await user.save()
}

async function scoreFuncTest(request) {
  const {currentUser, params} = request
  const {userId, type} = params
  let metadata = {recharge: 10}
  let result = await updateUserScore(userId, type, metadata)
  return result
}

var scoreFunc = {
  OP_SCORE,
  SCORE_OP_TYPE_FOCUS,
  SCORE_OP_TYPE_DEPOSIT,
  SCORE_OP_TYPE_RECHARGE,
  SCORE_OP_TYPE_SERVICE,
  SCORE_OP_TYPE_BIND_PHONE,
  SCORE_OP_TYPE_ID_AUTH,
  SCORE_OP_TYPE_EXCHANGE,
  updateUserScore,
  subtractUserScore,
  scoreFuncTest,
}

module.exports = scoreFunc