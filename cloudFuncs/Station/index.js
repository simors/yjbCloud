/**
 * Created by wanpeng on 2017/9/15.
 */
var AV = require('leanengine');
var Promise = require('bluebird')

//服务点
function constructStationInfo(station, includeAdmin) {
  if (!station) {
    return undefined
  }
  let constructUserInfo = require('../Auth').constructUserInfo
  let stationInfo = {}

  let admin = station.attributes.admin
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
  if (includeAdmin) {
    stationInfo.admin = constructUserInfo(admin)
  }
  stationInfo.status = station.attributes.status
  stationInfo.deviceNo = station.attributes.deviceNo
  stationInfo.createdAt = station.createdAt

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
  profitSharingInfo.shareholderName = shareholder.attributes.nickname
  profitSharingInfo.shareholderPhone = shareholder.attributes.mobilePhoneNumber
  profitSharingInfo.stationId = station.id
  profitSharingInfo.stationName = station.attributes.name
  profitSharingInfo.status = profitSharing.attributes.status
  profitSharingInfo.createdAt = profitSharing.createdAt
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
  var userId = request.params.userId                //网点管理员userId
  var unitPrice = request.params.unitPrice            //设备使用单价，单位：元／分钟
  var deposit = request.params.deposit                //设备使用押金，单位：¥元
  var powerUnitPrice = request.params.powerUnitPrice  //电费单价，单位：元／KWh
  var platformProp = request.params.platformProp      //平台分成比例
  var stationProp = request.params.stationProp        //服务网点分成比例

  var query = new AV.Query('Station')
  query.equalTo('name', name)

  query.first().then((stationRecord) => {
    if (stationRecord) {
      response.error(new Error("服务网点名字重复"))
      return
    }
    var user = AV.Object.createWithoutData('_User', userId)
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
    station.set('admin', user)
    station.save().then((leanStation) => {
      var query = new AV.Query('Station')
      query.include('admin')
      query.get(leanStation.id).then((stationInfo)=> {
        response.success(constructStationInfo(stationInfo, true))
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
    query.equalTo('province.value', province)
  }
  if (city) {
    query.equalTo('city.value', city)
  }
  if (area) {
    query.equalTo('area.value', area)
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
  query.descending('createdDate')

  query.find().then((stationList)=> {
    var stations = []
    stationList.forEach((record)=> {
      var station = constructStationInfo(record, true)
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
  let queryName = new AV.Query('Station')
  queryName.equalTo('name',name)
  queryName.first().then((stationRecord) => {
    if (stationRecord&&stationRecord.id!=stationId) {
      response.error(new Error("服务网点名字重复"))
      return
    }
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
        response.success(constructStationInfo(stationInfo, true))
      })
    }).catch((error) => {
      console.log("createStation", error)
      response.error(error)
    })
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
  query.descending('createdDate')
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
  var station = undefined

  var query = new AV.Query('ProfitSharing')
  if (stationId) {
    station = AV.Object.createWithoutData('Station', stationId)
    query.equalTo('station', station)
  }
  query.equalTo('type', 'investor')
  if (status != undefined) {
    query.equalTo('status', status)
  }
  query.include(['station', 'shareholder'])
  query.descending('createdDate')
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
        console.log('sharing===>', sharing.id)
        sharingList.push(constructProfitSharing(sharing))
      })
      response.success(sharingList)
    }, (err)=> {
      response.error(err)
    })
  }
}

/**
 * 新建分成方信息
 * @param {Object}  request
 * @param {Object}  response
 */

async function createPartner(request, response) {
  try {
    let royalty = request.params.royalty
    let userId = request.params.userId
    let stationId = request.params.stationId
    let user = AV.Object.createWithoutData('_User', userId)
    let station = AV.Object.createWithoutData('Station', stationId)
    let query = new AV.Query('ProfitSharing')
    query.equalTo('station', station)
    query.equalTo('shareholder', user)
    query.equalTo('type', 'partner')
    let prePartner = await query.first()
    let status = request.params.status
    console.log('prePartne===>', prePartner)
    if (prePartner) {
      response.error(new Error('已经存在该分成方'))
      return
    }
    let Partner = AV.Object.extend('ProfitSharing')
    let partner = new Partner()
    partner.set('shareholder', user)
    partner.set('station', station)
    partner.set('royalty', royalty)
    partner.set('status', status)
    partner.set('type', 'partner')
    let newPartner = await partner.save()
    let queryNew = new AV.Query('ProfitSharing')
    queryNew.include(['station', 'shareholder'])
    let finPartner = await queryNew.get(newPartner.id)
    response.success(constructProfitSharing(finPartner, true))
  } catch (err) {
    response.error(err)
  }

}

/**
 * 更新分成方信息
 * @param {Object}  request
 * @param {Object}  response
 */

async function updatePartner(request, response) {
  try {
    let royalty = request.params.royalty
    let userId = request.params.userId
    let stationId = request.params.stationId
    let partnerId = request.params.partnerId
    let user = AV.Object.createWithoutData('_User', userId)
    let station = AV.Object.createWithoutData('Station', stationId)
    let status = request.params.status

    let partner = AV.Object.createWithoutData('ProfitSharing', partnerId)
    partner.set('shareholder', user)
    partner.set('station', station)
    partner.set('royalty', royalty)
    partner.set('status', status)
    partner.set('type', 'partner')
    let newPartner = await partner.save()
    let queryNew = new AV.Query('ProfitSharing')
    queryNew.include(['station', 'shareholder'])
    let finPartner = await queryNew.get(newPartner.id)
    response.success(constructProfitSharing(finPartner, true))
  } catch (err) {
    response.error(err)
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
  // var royalty = request.params.royalty
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
      // investor.set('royalty', royalty)
      investor.set('investment', investment)
      investor.set('type', 'investor')
      investor.set('status', 1)
      investor.save().then((item)=> {
        var queryStation = new AV.Query('Station')
        queryStation.get(stationId).then((stationInfo)=> {
          var investmentSum = stationInfo.attributes.investment
          investmentSum = investmentSum + investment
          station.set('investment', investmentSum)
          station.save().then(()=> {
            var query = new AV.Query('ProfitSharing')
            query.include(['shareholder', 'station', 'station.admin'])
            query.equalTo('station', station)
            query.equalTo('status', 1)
            query.equalTo('type', 'investor')
            query.find().then((sharings)=> {
              var shareList = []
              sharings.forEach((share)=> {
                var shareInfo = AV.Object.createWithoutData('ProfitSharing', share.id)
                var royalty = Math.round(share.attributes.investment / investmentSum * 100) / 100.00
                shareInfo.set('royalty', royalty)
                shareList.push(shareInfo)
              })
              AV.Object.saveAll(shareList).then(()=> {
                query.find().then((results)=> {
                  if (results && results.length > 0) {
                    var investors = []
                    results.forEach((result)=> {
                      investors.push(constructProfitSharing(result))
                    })
                    response.success(investors)
                  }

                })
              })
            }, (err)=> {
              response.error(err)
            })
          })
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
  // var royalty = request.params.royalty
  var status = request.params.status
  var investor = AV.Object.createWithoutData('ProfitSharing', investorId)
  var station = AV.Object.createWithoutData('Station', stationId)
  var user = AV.Object.createWithoutData('_User', userId)
  var queryShare = new AV.Query('ProfitSharing')
  queryShare.get(investorId).then((record)=> {
    var preInvestment = record.attributes.investment
    investor.set('shareholder', user)
    investor.set('station', station)
    // investor.set('royalty', royalty)
    investor.set('investment', investment)
    investor.set('type', 'investor')
    if (status != undefined) {
      investor.set('status', status)
    }
    investor.save().then((item)=> {
      var queryStation = new AV.Query('Station')
      queryStation.get(stationId).then((stationInfo)=> {
        var investmentSum = stationInfo.attributes.investment
        if (stationInfo.attributes.status == 1) {
          investmentSum = investmentSum + investment - preInvestment
          station.set('investment', investmentSum)
        }
        station.save().then(()=> {
          var query = new AV.Query('ProfitSharing')
          query.include(['shareholder', 'station', 'station.admin'])
          query.equalTo('station', station)
          query.equalTo('status', 1)
          query.equalTo('type', 'investor')
          query.find().then((sharings)=> {
            var shareList = []
            sharings.forEach((share)=> {
              var shareInfo = AV.Object.createWithoutData('ProfitSharing', share.id)
              var royalty = Math.round(share.attributes.investment / investmentSum * 100) / 100.00
              shareInfo.set('royalty', royalty)
              shareList.push(shareInfo)
            })
            AV.Object.saveAll(shareList).then(()=> {
              query.find().then((results)=> {
                if (results && results.length > 0) {
                  var investors = []
                  results.forEach((result)=> {
                    investors.push(constructProfitSharing(result))
                  })
                  response.success(investors)
                } else {
                  response.success()
                }
              })
            })
          }, (err)=> {
            response.error(err)
          })
        })
      })
    }, (err)=> {
      response.error(err)
    })
  })
}

/**
 * 启用服务点
 * @param {Object}  request
 * @param {Object}  response
 */

function openStation(request, response) {
  var stationId = request.params.stationId
  var station = AV.Object.createWithoutData('Station', stationId)
  station.set('status', 1)
  station.save().then((item)=> {
    var query = new AV.Query('Station')
    query.include(['admin'])
    query.get(item.id).then((result)=> {
      response.success(constructStationInfo(result, true))
    }, (err)=> {
      response.error(err)
    })
  }, (err)=> {
    response.error(err)
  })
}

/**
 * 启用分成方
 * @param {Object}  request
 * @param {Object}  response
 */

function openPartner(request, response) {
  var partnerId = request.params.partnerId
  var partner = AV.Object.createWithoutData('ProfitSharing', partnerId)
  partner.set('status', 1)
  partner.save().then((item)=> {
    var query = new AV.Query('ProfitSharing')
    query.include(['station', 'shareholder'])
    query.get(item.id).then((result)=> {
      response.success(constructProfitSharing(result))
    }, (err)=> {
      response.error(err)
    })
  }, (err)=> {
    response.error(err)
  })
}

/**
 * 禁用分成方
 * @param {Object}  request
 * @param {Object}  response
 */

function closePartner(request, response) {
  var partnerId = request.params.partnerId
  var partner = AV.Object.createWithoutData('ProfitSharing', partnerId)
  partner.set('status', 0)
  partner.save().then((item)=> {
    var query = new AV.Query('ProfitSharing')
    query.include(['station', 'shareholder'])
    query.get(item.id).then((result)=> {
      response.success(constructProfitSharing(result))
    }, (err)=> {
      response.error(err)
    })
  }, (err)=> {
    response.error(err)
  })
}

/**
 * 启用投资人
 * @param {Object}  request
 * @param {Object}  response
 */

function openInvestor(request, response) {
  var investorId = request.params.investorId
  // var stationId = request.params.stationId
  // var royalty = request.params.royalty
  var investor = AV.Object.createWithoutData('ProfitSharing', investorId)
  var queryShare = new AV.Query('ProfitSharing')
  queryShare.get(investorId).then((record)=> {
    var preInvestment = record.attributes.investment
    // console.log('record========>',record.attributes.station)
    var station = AV.Object.createWithoutData('Station', record.attributes.station.id)
    if (record.attributes.status == 1) {
      response.error({message: '该投资人已经被启用'})
      return
    }
    investor.set('status', 1)
    investor.save().then((item)=> {
      var queryStation = new AV.Query('Station')
      queryStation.get(record.attributes.station.id).then((stationInfo)=> {
        var investmentSum = stationInfo.attributes.investment
        investmentSum = investmentSum + preInvestment
        station.set('investment', investmentSum)
        station.save().then(()=> {
          var query = new AV.Query('ProfitSharing')
          query.include(['shareholder', 'station', 'station.admin'])
          query.equalTo('station', station)
          query.equalTo('status', 1)
          query.equalTo('type', 'investor')
          query.find().then((sharings)=> {
            var shareList = []
            sharings.forEach((share)=> {
              var shareInfo = AV.Object.createWithoutData('ProfitSharing', share.id)
              var royalty = Math.round(share.attributes.investment / investmentSum * 100) / 100.00
              shareInfo.set('royalty', royalty)
              shareList.push(shareInfo)
            })
            AV.Object.saveAll(shareList).then(()=> {
              query.find().then((results)=> {
                if (results && results.length > 0) {
                  var investors = []
                  results.forEach((result)=> {
                    investors.push(constructProfitSharing(result))
                  })
                  response.success(investors)
                } else {
                  response.success()
                }
              })
            })
          }, (err)=> {
            response.error(err)
          })
        })
      })
    }, (err)=> {
      response.error(err)
    })
  })
}

/**
 * 禁用投资人
 * @param {Object}  request
 * @param {Object}  response
 */

function closeInvestor(request, response) {
  var investorId = request.params.investorId
  // var stationId = request.params.stationId
  // var royalty = request.params.royalty
  var investor = AV.Object.createWithoutData('ProfitSharing', investorId)
  var queryShare = new AV.Query('ProfitSharing')
  queryShare.get(investorId).then((record)=> {
    var preInvestment = record.attributes.investment
    // console.log('record========>',record.attributes.station)
    var station = AV.Object.createWithoutData('Station', record.attributes.station.id)
    if (record.attributes.status == 0) {
      response.error({message: '该投资人已经被禁用'})
      return
    }
    investor.set('status', 0)
    investor.set('royalty', 0)
    investor.save().then((item)=> {
      var queryStation = new AV.Query('Station')
      queryStation.get(record.attributes.station.id).then((stationInfo)=> {
        var investmentSum = stationInfo.attributes.investment
        investmentSum = investmentSum - preInvestment
        station.set('investment', investmentSum)
        station.save().then(()=> {
          var query = new AV.Query('ProfitSharing')
          query.include(['shareholder', 'station', 'station.admin'])
          query.equalTo('station', station)
          query.equalTo('status', 1)
          query.equalTo('type', 'investor')
          query.find().then((sharings)=> {
            var shareList = []
            sharings.forEach((share)=> {
              var shareInfo = AV.Object.createWithoutData('ProfitSharing', share.id)
              var royalty = Math.round(share.attributes.investment / investmentSum * 100) / 100.00
              shareInfo.set('royalty', royalty)
              shareList.push(shareInfo)
            })
            AV.Object.saveAll(shareList).then(()=> {
              query.find().then((results)=> {
                if (results && results.length > 0) {
                  var investors = []
                  results.forEach((result)=> {
                    investors.push(constructProfitSharing(result))
                  })
                  response.success(investors)
                } else {
                  response.success()
                }

              })
            })
          }, (err)=> {
            response.error(err)
          })
        })
      })
    }, (err)=> {
      response.error(err)
    })
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
      response.success(constructStationInfo(result, true))
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
    return constructStationInfo(station, true)
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
  constructStationInfo: constructStationInfo,
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
  closeInvestor: closeInvestor,
  openInvestor: openInvestor,
  createPartner: createPartner,
  updatePartner: updatePartner,
  openPartner: openPartner,
  closePartner: closePartner,
}

module.exports = stationFunc
