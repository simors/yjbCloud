/**
 * Created by wanpeng on 2017/8/9.
 */
'use strict'
// import http from 'http'
const http = require('http')
import Promise from 'bluebird'

//生产一个任意范围等随机数
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

/**
 * 通过淘宝IP地址库获取地理信息
 * @param {String} ip  客户端ip
 * @returns {Object} addrInfo 地理位置信息
 */
function getIpInfo(ip) {
  if(!ip) {
    return undefined
  }
  const options = {
    port: 80,
    hostname: 'ip.taobao.com',
    path: '/service/getIpInfo.php?ip=' + ip,
    method: 'GET',
  }
  return new Promise((resolve, reject) => {
    let reqGet = http.request(options, function (res) {
      res.on('data', function (buffer) {
        let dataObj = JSON.parse(buffer.toString())
        let code = dataObj.code
        let data = dataObj.data
        if(code === 0) {
          resolve(data)
        } else {
          reject(data)
        }
      })
    })
    reqGet.end()
    reqGet.on('error', function (error) {
      console.error(error)
      reject(error)
    })
  })
}

/**
 * 获取客户端ip地址
 * @param req
 * @returns {*|string}
 */
function getClientIp(req) {
  return req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
}


async function utilFuncTest(request) {
  const {currentUser, params, meta} = request
  let remoteAddress = meta.remoteAddress
  console.log("remoteAddress:", remoteAddress)
  let addrInfo = await getIpInfo('113.246.95.237')
  return addrInfo
}

var utilFunc = {
  utilFuncTest: utilFuncTest,
  getRandomArbitrary: getRandomArbitrary,
  getIpInfo: getIpInfo,
  getClientIp: getClientIp,
}

module.exports = utilFunc