/**
 * Created by wanpeng on 2017/9/15.
 */
var AV = require('leanengine');
var Promise = require('bluebird')

function constructStationInfo(station) {
  var stationInfo = {}

  var admin = station.attributes.admin
  stationInfo.id = station.id
  stationInfo.name = station.attributes.name
  stationInfo.addr = station.attributes.addr
  stationInfo.province = station.attributes.province
  stationInfo.city = station.attributes.city
  stationInfo.area = station.attributes.area
  stationInfo.unitPrice = station.attributes.unitPrice
  stationInfo.deposit = station.attributes.deposit
  stationInfo.powerUnitPrice = station.attributes.powerUnitPrice
  stationInfo.platformProp = station.attributes.platformProp
  stationInfo.stationProp = station.attributes.stationProp
  stationInfo.adminId = admin.id
  return stationInfo
}

/**
 * 创建服务网点
 * @param {Object}  request
 * @param {Object}  response
 */
function createStation(request, response) {
  var currentUser = request.params.currentUser
  var name = request.params.name
  var addr = request.params.addr                      //详细地址
  var province = request.params.province              //省份
  var city = request.params.city                      //城市
  var area = request.params.area                      //区
  var adminId = request.params.adminId                //网点管理员userId
  var unitPrice = request.params.unitPrice            //设备使用单价，单位：元／分钟
  var deposit = request.params.deposit                //设备使用押金，单位：¥元
  var powerUnitPrice = request.params.powerUnitPrice  //电费单价，单位：元／KWh
  var platformProp = request.params.platformProp      //平台分成比例
  var stationProp = request.params.stationProp        //服务网点分成比例

  var query = new AV.Query('Station')
  query.equalTo('name', name)

  query.first().then((station) => {
    if(station) {
      response.error(new Error("服务网点名字重复"))
      return
    }
    var admin = AV.Object.createWithoutData('_User', adminId)
    var Station = AV.Object.extend('Station')
    var station = new Station()
    station.set('name', name)
    station.set('addr', addr)
    station.set('province', province)
    station.set('city', city)
    station.set('area', area)
    station.set('unitPrice', unitPrice)
    station.set('deposit', deposit)
    station.set('powerUnitPrice', powerUnitPrice)
    station.set('platformProp', platformProp)
    station.set('stationProp', stationProp)
    station.set('admin', admin)

    station.save().then((leanStation) => {
      if(request.params.shareList && request.params.shareList.length>0){
        var shareList =request.params.shareList
        var promise = []
        shareList.forEach((item)=>{
          var Share = AV.Object.extend('ProfitSharing')
          var share = new Share()
          var station = AV.Object.createWithoutData('Station',leanStation.id)
          share.set('station',station)
          var partner = AV.Object.createWithoutData('_User',item.userId)
          share.set('shareholder',partner)
          share.set('type','partner')
          share.set('royalty',item.royalty)
          promise.push(share.save())
        })
        Promise.all(promise).then(()=>{
          response.success(constructStationInfo(leanStation))
        },(err)=>{
          response.error(err)
        })

      }else{
        response.success(constructStationInfo(leanStation))
      }
    }).catch((error) => {
      console.log("createStation", error)
      response.error(error)
    })
  })

}

/**
 * 查询服务网点
 * @param {Object}  request
 * @param {Object}  response
 */

function fetchStations(request, response) {

}

/**
 * 更新服务网点信息
 * @param {Object}  request
 * @param {Object}  response
 */

function updateStation(request, response) {

}

var stationFunc = {
  createStation: createStation,
  fetchStations: fetchStations,
  updateStation: updateStation,
}

module.exports = stationFunc
