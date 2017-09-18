/**
 * Created by wanpeng on 2017/9/15.
 */
var AV = require('leanengine');
var Promise = require('bluebird')

//服务点
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
  stationInfo.adminName = admin.attributes.nickname
  stationInfo.adminPhone = admin.attributes.mobilePhoneNumber
  stationInfo.status = station.attributes.status

  return stationInfo
}

function constructProfitSharing(profitSharing) {
  var profitSharingInfo = {}

  var shareholder = profitSharing.attributes.shareholder
  var station = profitSharing.attributes.station
  profitSharingInfo.id = profitSharing.id
  profitSharingInfo.type = profitSharing.attributes.type
  profitSharingInfo.royalty = profitSharing.attributes.royalty
  profitSharingInfo.investment = profitSharing.attributes.investment
  profitSharingInfo.shareholderId = shareholder.id
  profitSharingInfo.sharehlderName = shareholder.attributes.nickname
  profitSharingInfo.sharehlderPhone = shareholder.attributes.mobilePhoneNumber
  profitSharingInfo.stationId = station.id
  profitSharingInfo.stationName = station.attributes.name
  return profitSharingInfo
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
    if (station) {
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
      var query = new AV.Query('Station')
      query.include('admin')
      query.get(leanStation.id).then((stationInfo)=> {
        if (request.params.shareList && request.params.shareList.length > 0) {
          var shareList = request.params.shareList
          var promise = []
          shareList.forEach((item)=> {
            var Share = AV.Object.extend('ProfitSharing')
            var share = new Share()
            var station = AV.Object.createWithoutData('Station', leanStation.id)
            share.set('station', station)
            var partner = AV.Object.createWithoutData('_User', item.userId)
            share.set('shareholder', partner)
            share.set('type', 'partner')
            share.set('royalty', item.royalty)
            share.set('status', 1)
            promise.push(share.save())
          })
          Promise.all(promise).then(()=> {
            response.success(constructStationInfo(stationInfo))
          }, (err)=> {
            response.error(err)
          })

        } else {
          response.success(constructStationInfo(stationInfo))
        }
      })
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
  var province = request.params.province
  var city = request.params.city
  var area = request.params.area
  var name = request.params.name
  var limit = request.params.limit || 100
  var status = request.params.status
  var addr = request.params.addr
  var lastCreatedAt = request.params.lastCreatedAt
  var query = new AV.Query('Station')
  if (province) {
    query.equalTo('province', province)
  }
  if (city) {
    query.equalTo('city', city)
  }
  if (area) {
    query.equalTo('area', area)
  }
  if (name) {
    query.equalTo('name', name)
  }
  if (status != undefined) {
    query.equalTo('status', status)
  }
  if (addr) {
    query.equalTo('addr', addr)
  }
  if (lastCreatedAt) {
    query.lessThan('createdAt', lastCreatedAt)
  }
  query.limit(limit)
  query.include(['admin'])
  query.find().then((stationList)=> {
    var stations = []
    stationList.forEach((record)=> {
      var station = constructStationInfo(record)
      stations.push(station)
    })
    response.success(stations)
  }, (err)=> {
    response.error(err)
  })
}

/**
 * 更新服务网点信息
 * @param {Object}  request
 * @param {Object}  response
 */

function updateStation(request, response) {
  var stationId = request.params.stationId
  var status = request.params.status
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
  var admin = AV.Object.createWithoutData('_User', adminId)
  var station = AV.Object.createWithoutData('Station', stationId)

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
  if (status != undefined) {
    station.set('status', status)
  }
  station.save().then((leanStation) => {
    var query = new AV.Query('Station')
    query.include('admin')
    query.get(leanStation.id).then((stationInfo)=> {
      var querySharing = new AV.Query('ProfitSharing')
      querySharing.equalTo('station', station)
      querySharing.equalTo('status', 1)
      querySharing.equalTo('type', 'partner')
      querySharing.find().then((shares)=> {
        var preShares = []
        shares.forEach((share)=> {
          // console.log('share=======>',share)
          var shareInfo = AV.Object.createWithoutData('ProfitSharing', share.id)
          shareInfo.set('status', 0)
          preShares.push(shareInfo)
        })
        AV.Object.saveAll(preShares).then(()=> {
          if (request.params.shareList && request.params.shareList.length > 0) {
            var shareList = request.params.shareList
            var promise = []
            shareList.forEach((item)=> {
              var Share = AV.Object.extend('ProfitSharing')
              var share = new Share()
              var station = AV.Object.createWithoutData('Station', leanStation.id)
              share.set('station', station)
              var partner = AV.Object.createWithoutData('_User', item.userId)
              share.set('shareholder', partner)
              share.set('type', 'partner')
              share.set('royalty', item.royalty)
              share.set('status', 1)
              promise.push(share.save())
            })
            Promise.all(promise).then(()=> {
              response.success(constructStationInfo(stationInfo))
            }, (err)=> {
              response.error(err)
            })
          } else {
            response.success(constructStationInfo(stationInfo))
          }
        })
      })
    })
  }).catch((error) => {
    console.log("createStation", error)
    response.error(error)
  })
}

/**
 * 拉取服务点下合作平台信息
 * @param {Object}  request
 * @param {Object}  response
 */

function fetchPartnerByStationId(request, response) {
  var stationId = request.params.stationId
  var station = AV.Object.createWithoutData('Station', stationId)
  var query = new AV.Query('ProfitSharing')
  query.equalTo('station', station)
  query.equalTo('type', 'partner')
  query.include(['station', 'shareholder'])
  query.find().then((sharings)=> {
    var sharingList = []
    sharings.forEach((sharing)=> {
      sharingList.push(constructProfitSharing(sharing))
    })
    response.success(sharingList)
  }, (err)=> {
    response.error(err)
  })
}

/**
 * 拉取服务点下投资人列表
 * @param {Object}  request
 * @param {Object}  response
 */

function fetchInvestorByStationId(request, response) {
  var stationId = request.params.stationId
  var status = request.params.status
  var username = request.params.username
  var station = AV.Object.createWithoutData('Station', stationId)
  var query = new AV.Query('ProfitSharing')
  query.equalTo('station', station)
  query.equalTo('type', 'investor')
  if (status != undefined) {
    query.equalTo('status', status)
  }
  query.include(['station', 'shareholder'])
  if (username) {
    var queryUser = new AV.Query('_User')
    queryUser.equalTo('nickname', username)
    queryUser.find().then((users)=> {
      var userList = []
      users.forEach((user)=> {
        var userInfo = AV.Object.createWithoutData('_User', user.id)
        userList.push(userInfo)
      })
      query.containedIn('shareholder', userList)
      query.find().then((sharings)=> {
        var sharingList = []
        sharings.forEach((sharing)=> {
          sharingList.push(constructProfitSharing(sharing))
        })
        response.success(sharingList)
      }, (err)=> {
        response.error(err)
      })
    })
  } else {
    query.find().then((sharings)=> {
      var sharingList = []
      sharings.forEach((sharing)=> {
        sharingList.push(constructProfitSharing(sharing))
      })
      response.success(sharingList)
    }, (err)=> {
      response.error(err)
    })
  }
}

/**
 * 新建服务点投资人信息
 * @param {Object}  request
 * @param {Object}  response
 */

function createInvestor(request, response) {
  var stationId = request.params.stationId
  var userId = request.params.userId
  var investment = request.params.investment
  var royalty = request.params.royalty
  var Investor = AV.Object.extend('ProfitSharing')
  var investor = new Investor()
  var station = AV.Object.createWithoutData('Station', stationId)
  var user = AV.Object.createWithoutData('_User', userId)
  var queryPre = new AV.Query('ProfitSharing')
  queryPre.equalTo('shareholder', user)
  queryPre.equalTo('station', station)
  queryPre.equalTo('status', 1)
  queryPre.equalTo('type', 'investor')
  queryPre.first().then((item)=> {
    if (item) {
      response.error(new Error("该服务点已有该投资人!"))
      return
    } else {
      investor.set('shareholder', user)
      investor.set('station', station)
      investor.set('royalty', royalty)
      investor.set('investment', investment)
      investor.set('type', 'investor')
      investor.set('status', 1)
      investor.save().then((item)=> {
        var query = new AV.Query('ProfitSharing')
        query.include(['shareholder', 'station'])
        query.get(item.id).then((sharing)=> {
          response.success(constructProfitSharing(sharing))
        }, (err)=> {
          response.error(err)
        })
      }, (err)=> {
        response.error(err)
      })
    }
  }, (err)=> {
    response.error(err)
  })
}

/**
 * 更新服务点投资人信息
 * @param {Object}  request
 * @param {Object}  response
 */

function updateInvestor(request, response) {
  var investorId = request.params.investorId
  var stationId = request.params.stationId
  var userId = request.params.userId
  var investment = request.params.investment
  var royalty = request.params.royalty
  var status = request.params.status
  var investor = AV.Object.createWithoutData('ProfitSharing', investorId)
  var station = AV.Object.createWithoutData('Station', stationId)
  var user = AV.Object.createWithoutData('_User', userId)
  investor.set('shareholder', user)
  investor.set('station', station)
  investor.set('royalty', royalty)
  investor.set('investment', investment)
  investor.set('type', 'investor')
  if (status != undefined) {
    investor.set('status', status)
  }
  investor.save().then((item)=> {
    var query = new AV.Query('ProfitSharing')
    query.include(['shareholder', 'station'])
    query.get(item.id).then((sharing)=> {
      response.success(constructProfitSharing(sharing))
    }, (err)=> {
      response.error(err)
    })
  }, (err)=> {
    response.error(err)
  })
}

function openStation(request, response) {
  var stationId = request.params.stationId
  var station = AV.Object.createWithoutData('Station', stationId)
  station.set('status', 1)
  station.save().then((item)=> {
    var query = new AV.Query('Station')
    query.include(['admin'])
    query.get(item.id).then((result)=> {
      response.success(constructStationInfo(result))
    }, (err)=> {
      response.error(err)
    })
  }, (err)=> {
    response.error(err)
  })
}

function closeStation(request, response) {
  var stationId = request.params.stationId
  var station = AV.Object.createWithoutData('Station', stationId)
  station.set('status', 0)
  station.save().then((item)=> {
    var query = new AV.Query('Station')
    query.include(['admin'])
    query.get(item.id).then((result)=> {
      response.success(constructStationInfo(result))
    }, (err)=> {
      response.error(err)
    })
  }, (err)=> {
    response.error(err)
  })
}
/**
 * 通过设备编号获取服务网点信息
 * @param {String}  deviceNo
 */
function getStationInfoByDeviceNo(deviceNo) {
  let query = new AV.Query('Device')
  query.equalTo('deviceNo', deviceNo)
  query.include('station')
  return query.find().then((results) => {
    if (results.length != 1) {
      return undefined
    }
    let device = results[0]
    let station = device.attributes.station
    if (!station) {
      return undefined
    }
    let stationId = station.id
    var query = new AV.Query('Station')
    query.include('admin')
    return query.get(stationId)
  }).then((station) => {
    return constructStationInfo(station)
  }).catch((error) => {
    console.error(error)
    throw error
  })
}

function stationFuncTest(request, response) {
  var deviceNo = request.params.deviceNo
  getStationInfoByDeviceNo(deviceNo).then((stationInfo) => {
    response.success(stationInfo)
  }).catch((error) => {
    response.error(error)
  })
}

var stationFunc = {
  createStation: createStation,
  fetchStations: fetchStations,
  updateStation: updateStation,
  openStation: openStation,
  closeStation: closeStation,
  fetchPartnerByStationId: fetchPartnerByStationId,
  fetchInvestorByStationId: fetchInvestorByStationId,
  createInvestor: createInvestor,
  updateInvestor: updateInvestor,
  getStationInfoByDeviceNo: getStationInfoByDeviceNo,
  stationFuncTest: stationFuncTest,
}

module.exports = stationFunc
