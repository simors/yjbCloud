/**
 * Created by wanpeng on 2017/8/9.
 */
'use strict'


//生产一个任意范围等随机数
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

var utilFunc = {
  getRandomArbitrary: getRandomArbitrary
}

module.exports = utilFunc