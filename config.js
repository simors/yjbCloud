/**
 * Created by wanpeng on 2017/8/7.
 */

//LeanCloud环境参数
const LC_DEV_APP_ID = 'QApBtOkMNfNo0lGaHxKBSWXX-gzGzoHsz'       //开发环境
const LC_STAGE_APP_ID = 'HFRm8OUW9tNj2qxz6LuBExBa-gzGzoHsz'     //预上线环境
const LC_PRO_APP_ID = ''                                        //生产环境

//微信公众平台
var MP_SERVER_DOMAIN = "http://local_mp.ngrok.io"               //leancloud云引擎域名
var MP_CLIENT_DOMAIN = "http://yiijiabao.ngrok.io"              //微信公众号客户端域名
var WECHAT_MP_TOKEN = ""
var WECHAT_MP_APPID = ""
var WECHAT_MP_APPSECRET = ""
var WECHAT_MP_AESKEY = ""
var WECHAT_MSG_TMPID_RECHARGE = "BG2I_dX7Fvgkxo1RkuXOd6WxErva97dwo6gAZNtvjAg"       //充值成功模版消息ID
var WECHAT_MSG_TMPID_TURNON = ""                                //开锁成功模版消息ID
var WECHAT_MSG_TMPID_FINISH = "mABMJhtxleOHUkOMw7Tm7nvFaE6vq3oi_t5j1pA_MXY"        //干衣完成模版消息ID
var WECHAT_MSG_TMPID_PAYMENT = "erHnfN3EjT4_lV3G8HdXU4H3QbJsnqg2b0rGGdueB0w"        //订单支付模版消息ID
var WECHAT_MSG_TMPID_SYSTEM = ""                                 //后台系统通知模版消息ID
var WECHAT_MSG_TMPID_FAULT = "fd65vazlLFlRjxmWhR5UVPvNpOw5hun-5HkR1X6eLdk"          //干衣柜故障通知模版消息ID
var WECHAT_MSG_TMPID_AUTH_CODE = 'YkwBfWO9jCbTf25y6c2Tf2mUx0Ok5zFcxEaHgIToksA'      // 系统管理员授权码通知模板消息ID


const MP_SERVER_DOMAIN_DEV = "http://yiijiabao-dev.leanapp.cn"
const MP_CLIENT_DOMAIN_DEV = "http://yiijiabao.ngrok.io"
const WECHAT_MP_TOKEN_DEV = "YiJiaBao2017dev"
const WECHAT_MP_APPID_DEV = "wx2c7e7f1a67c78900"
const WECHAT_MP_AESKEY_DEV = "mBQTyvW4OlskuxHYWv0261sYw1w8EZw4vj6cQ6gOWNw"
const WECHAT_MP_APPSECRET_DEV = "7e053e63bc216611878697fdb5d8edc6"

const MP_SERVER_DOMAIN_PRE = "http://yiijiabao-pre.leanapp.cn"
const MP_CLIENT_DOMAIN_PRE = "http://dev.yiijiabao.com"
const WECHAT_MP_TOKEN_PRE = "YiJiaBao2017pre"
const WECHAT_MP_APPID_PRE = "wx792bf5a51051d512"
const WECHAT_MP_AESKEY_PRE = "mBQTyvW4OlskuxHYWv0261sYw1w8EZw4vj6cQ6gOWNw"
const WECHAT_MP_APPSECRET_PRE ="d9ebabc3e81cb6b0c6f4e48af40d6abb"

const MP_SERVER_DOMAIN_PRO = ""
const MP_CLIENT_DOMAIN_PRO = ""
const WECHAT_MP_TOKEN_PRO = "YiJiaBao2017pro"
const WECHAT_MP_APPID_PRO = "wx792bf5a51051d512"
const WECHAT_MP_AESKEY_PRO = "K65BlkT0U2lH1SntekBotsAhKX0VLo94bMTQDAZudIY"
const WECHAT_MP_APPSECRET_PRO = "d9ebabc3e81cb6b0c6f4e48af40d6abb"

//redis配置
var REDIS_URL = process.env.REDIS_URL
var REDIS_PORT = process.env.REDIS_PORT
var DEBUG_REDIS = 0
var PRE_REDIS = 1
var PROD_REDIS = 2
var REDIS_DB = 0
var REDIS_AUTH = process.env.REDIS_AUTH


//rabbitMQ配置
var RABBITMQ_URL = process.env.RABBITMQ_URL

//mqtt配置
var MQTT_SERVER_URL = process.env.MQTT_SERVER_URL

// mysql数据库配置
const MYSQL_HOST = process.env.MYSQL_HOST
var MYSQL_USER = process.env.MYSQL_USER
var MYSQL_PWD = process.env.MYSQL_PWD
var MYSQL_DB = process.env.MYSQL_DB

//Ping++应用配置
var PINGPP_APP_ID = ""
var PINGPP_API_KEY = process.env.PINGPP_LIVE_API_KEY //Secret Key
var PINGPP_TEST_API_KEY_DEV = "sk_test_fbTiHOOG0008r9Sq10GWXXnT" //注意：开发环境使用汇邻优店账户下的app
var PINGPP_TEST_API_KEY = "sk_test_HKm9W904GqD0e9irLSLiv5eL" //Secret Key
var PINGPP_DEV_APP_ID = "app_a5KeT8HKCSCG1yLa" //衣家宝-DEV应用 Id
var PINGPP_PRE_APP_ID = "app_qbzH8SmPqL48qLSu" //衣家宝-PRE应用 Id
var PINGPP_PRO_APP_ID = "" //衣家宝-PRO应用 Id




if(process.env.LEANCLOUD_APP_ID === LC_DEV_APP_ID) {  //开发环境
  MP_SERVER_DOMAIN = MP_SERVER_DOMAIN_DEV
  MP_CLIENT_DOMAIN = MP_CLIENT_DOMAIN_DEV
  WECHAT_MP_TOKEN = WECHAT_MP_TOKEN_DEV
  WECHAT_MP_APPID = WECHAT_MP_APPID_DEV
  WECHAT_MP_APPSECRET = WECHAT_MP_APPSECRET_DEV
  WECHAT_MP_AESKEY = WECHAT_MP_AESKEY_DEV
  WECHAT_MSG_TMPID_RECHARGE = "5BPNrMaZQOHNZdQGF7cHIBXvvvlFFAOjxN5u6ID2XwE"
  WECHAT_MSG_TMPID_FINISH = "4o3gkG0xwAbzPU1UOjnI8EqCD_9-MHvbo5BjacANxCw"
  WECHAT_MSG_TMPID_PAYMENT = "UVm5h2TyVPplN-zM3pALzzPRdA5p-Ltx8XKaVJA6uMQ"
  WECHAT_MSG_TMPID_SYSTEM = ""
  WECHAT_MSG_TMPID_TURNON = ""
  WECHAT_MSG_TMPID_FAULT = "9pCwUfsKtO_uYGo6BlEy6Cd29YBayvR587XdXYl2FFQ"
  WECHAT_MSG_TMPID_AUTH_CODE = "YkwBfWO9jCbTf25y6c2Tf2mUx0Ok5zFcxEaHgIToksA"

  REDIS_DB = DEBUG_REDIS

  PINGPP_APP_ID = PINGPP_DEV_APP_ID

} else if(process.env.LEANCLOUD_APP_ID === LC_STAGE_APP_ID) {   //预上线环境
  MP_SERVER_DOMAIN = MP_SERVER_DOMAIN_PRE
  MP_CLIENT_DOMAIN = MP_CLIENT_DOMAIN_PRE
  WECHAT_MP_TOKEN = WECHAT_MP_TOKEN_PRE
  WECHAT_MP_APPID = WECHAT_MP_APPID_PRE
  WECHAT_MP_APPSECRET = WECHAT_MP_APPSECRET_PRE
  WECHAT_MP_AESKEY = WECHAT_MP_AESKEY_PRE
  WECHAT_MSG_TMPID_RECHARGE = "BG2I_dX7Fvgkxo1RkuXOd6WxErva97dwo6gAZNtvjAg"
  WECHAT_MSG_TMPID_FINISH = "mABMJhtxleOHUkOMw7Tm7nvFaE6vq3oi_t5j1pA_MXY"
  WECHAT_MSG_TMPID_PAYMENT = "erHnfN3EjT4_lV3G8HdXU4H3QbJsnqg2b0rGGdueB0w"
  WECHAT_MSG_TMPID_SYSTEM = ""
  WECHAT_MSG_TMPID_TURNON = ""
  WECHAT_MSG_TMPID_FAULT = "fd65vazlLFlRjxmWhR5UVPvNpOw5hun-5HkR1X6eLdk"
  WECHAT_MSG_TMPID_AUTH_CODE = "oxGEfFOWVrzmIgxAET0rr2yxCtlHCxSg_ZUfr98bc7E"


  REDIS_DB = PRE_REDIS

  PINGPP_APP_ID = PINGPP_PRE_APP_ID

} else if(process.env.LEANCLOUD_APP_ID === LC_PRO_APP_ID) {   //生产环境
  MP_SERVER_DOMAIN = MP_SERVER_DOMAIN_PRO
  MP_CLIENT_DOMAIN = MP_CLIENT_DOMAIN_PRO
  WECHAT_MP_TOKEN = WECHAT_MP_TOKEN_PRO
  WECHAT_MP_APPID = WECHAT_MP_APPID_PRO
  WECHAT_MP_APPSECRET = WECHAT_MP_APPSECRET_PRO
  WECHAT_MP_AESKEY = WECHAT_MP_AESKEY_PRO
  WECHAT_MSG_TMPID_RECHARGE = "BG2I_dX7Fvgkxo1RkuXOd6WxErva97dwo6gAZNtvjAg"
  WECHAT_MSG_TMPID_PAYMENT = "erHnfN3EjT4_lV3G8HdXU4H3QbJsnqg2b0rGGdueB0w"
  WECHAT_MSG_TMPID_FINISH = "mABMJhtxleOHUkOMw7Tm7nvFaE6vq3oi_t5j1pA_MXY"
  WECHAT_MSG_TMPID_SYSTEM = ""
  WECHAT_MSG_TMPID_TURNON = ""
  WECHAT_MSG_TMPID_FAULT = "fd65vazlLFlRjxmWhR5UVPvNpOw5hun-5HkR1X6eLdk"
  WECHAT_MSG_TMPID_AUTH_CODE = "oxGEfFOWVrzmIgxAET0rr2yxCtlHCxSg_ZUfr98bc7E"


  REDIS_DB = PROD_REDIS

  PINGPP_APP_ID = PINGPP_PRO_APP_ID
}

var GLOBAL_CONFIG = {
  MP_SERVER_DOMAIN: MP_SERVER_DOMAIN,
  MP_CLIENT_DOMAIN: MP_CLIENT_DOMAIN,
  WECHAT_MP_TOKEN: WECHAT_MP_TOKEN,
  WECHAT_MP_APPID: WECHAT_MP_APPID,
  WECHAT_MP_APPSECRET: WECHAT_MP_APPSECRET,
  WECHAT_MP_AESKEY: WECHAT_MP_AESKEY,
  WECHAT_MSG_TMPID_RECHARGE,
  WECHAT_MSG_TMPID_PAYMENT,
  WECHAT_MSG_TMPID_TURNON,
  WECHAT_MSG_TMPID_FINISH,
  WECHAT_MSG_TMPID_SYSTEM,
  WECHAT_MSG_TMPID_FAULT,
  WECHAT_MSG_TMPID_AUTH_CODE,

  REDIS_AUTH: REDIS_AUTH,
  REDIS_URL: REDIS_URL,
  REDIS_PORT: REDIS_PORT,
  REDIS_DB: REDIS_DB,

  RABBITMQ_URL: RABBITMQ_URL,
  MQTT_SERVER_URL: MQTT_SERVER_URL,

  MYSQL_HOST: MYSQL_HOST,
  MYSQL_USER: MYSQL_USER,
  MYSQL_PWD: MYSQL_PWD,
  MYSQL_DB: MYSQL_DB,

  PINGPP_APP_ID: PINGPP_APP_ID,
  PINGPP_API_KEY: PINGPP_API_KEY,

  LC_DEV_APP_ID: LC_DEV_APP_ID,
  LC_STAGE_APP_ID: LC_STAGE_APP_ID,
  LC_PRO_APP_ID: LC_PRO_APP_ID,
}

module.exports = GLOBAL_CONFIG