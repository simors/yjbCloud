/**
 * Created by wanpeng on 2017/8/7.
 */
var AV = require('leanengine');



function authFuncTest(request, response) {
  let message = "测试成功"

  response.success({
    message: message
  })
}

var authFunc = {
  authFuncTest: authFuncTest,
}

module.exports = authFunc