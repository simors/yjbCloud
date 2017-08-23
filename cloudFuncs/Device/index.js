/**
 * Created by wanpeng on 2017/8/22.
 */
var AV = require('leanengine');

function fetchDeviceInfo(request, response) {
  var deviceid = request.params.deviceid

}

function deviceFuncTest(request, response) {

}

var deviceFunc = {
  fetchDeviceInfo: fetchDeviceInfo,
  deviceFuncTest: deviceFuncTest,
}

module.exports = deviceFunc