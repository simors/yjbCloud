/**
 * Created by wanpeng on 2017/7/15.
 */
var GLOBAL_CONFIG = require('../../config')

var wechat_api = require('../index').wechat_api


function createMenu() {
  var memu = {
    "button":[
      {
        "type":"view",
        "name":"扫码开柜",
        "url": GLOBAL_CONFIG.MP_CLIENT_DOMAIN
      },
      {
        "type":"view",
        "name":"个人中心",
        "url": GLOBAL_CONFIG.MP_CLIENT_DOMAIN
      },
      {
        "type":"view",
        "name":"业务合作",
        "url": GLOBAL_CONFIG.MP_CLIENT_DOMAIN
      },
    ]
  }

  wechat_api.createMenu(memu, function (err, result) {
    if(err) {
      console.log(err)
    } else if(result.errcode != 0) {
      console.log("微信公众号菜单创建异常：", result.errmsg)
    } else {
      console.log("微信公众号菜单创建成功")
    }
  })
}


var mpMenuFuncs = {
  createMenu: createMenu
}

module.exports = mpMenuFuncs