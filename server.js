'use strict';
require('babel-register')
require("babel-polyfill")
var AV = require('leanengine');
var wechat_api = require('./mpFuncs').wechat_api
var mpMenuFuncs = require('./mpFuncs/Menu')
var mpTokenFuncs = require('./mpFuncs/Token')



AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY
});

// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

//获取微信公众号api token &创建菜单&获取js-sdk ticket
wechat_api.getLatestToken(function (err, token) {
  if(err) {
    console.warn("获取微信公众号token失败", err)
  } else {
    mpMenuFuncs.createMenu();
    wechat_api.registerTicketHandle(mpTokenFuncs.getTicketToken, mpTokenFuncs.saveTicketToken)
  }
})
wechat_api.getTicket(function (err, result) {
  if(err) {
    console.warn("获取微信公众号js-sdk ticket失败", result.errmsg)
  }
})

var server = require('./app')

//websocket
var websocketIO = require('./websocketIO')
var websocketFunc = require('./websocket')
websocketIO.sockets.on('connection', websocketFunc.connectionEvent)

//rabbitMQ
var amqp = require('./amqp')


//mqtt
var mqtt = require('./mqtt')


// 端口一定要从环境变量 `LEANCLOUD_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 3000);

server.listen(PORT, function (err) {
  console.log('Node app is running on port:', PORT);

  // 注册全局未捕获异常处理器
  process.on('uncaughtException', function(err) {
    console.error('Caught exception:', err.stack);
  });
  process.on('unhandledRejection', function(reason, p) {
    console.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason.stack);
  });
});
