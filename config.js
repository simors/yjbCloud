/**
 * Created by wanpeng on 2017/8/7.
 */

//LeanCloud环境参数
const LC_DEV_APP_ID = 'QApBtOkMNfNo0lGaHxKBSWXX-gzGzoHsz'      //开发环境
const LC_STAGE_APP_ID = 'HFRm8OUW9tNj2qxz6LuBExBa-gzGzoHsz'    //预上线环境
const LC_PRO_APP_ID = ''                                       //生产环境

//微信公众平台环境参数








if(process.env.LEANCLOUD_APP_ID === LC_DEV_APP_ID) {  //开发环境

} else if(process.env.LEANCLOUD_APP_ID === LC_STAGE_APP_ID) {   //预上线环境

} else if(process.env.LEANCLOUD_APP_ID === LC_PRO_APP_ID) {   //生产环境

}

var GLOBAL_CONFIG = {

}

module.exports = GLOBAL_CONFIG