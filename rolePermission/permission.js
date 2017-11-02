/**
 * Created by yangyang on 2017/10/20.
 */

export const PERMISSION_CODE = {
  /* 干衣柜综合管理 */
  DEVICE_QUERY_INFO:                          1000,         // 干衣柜综合管理/干衣柜信息管理/查看
  DEVICE_ASSOCIATE:                           1001,         // 干衣柜综合管理/干衣柜信息管理/关联
  DEVICE_EDIT_STATION_ADDR:                   1002,         // 干衣柜综合管理/干衣柜信息管理/编辑干衣柜位置
  DEVICE_CHANGE_STATUS:                       1003,         // 干衣柜综合管理/干衣柜信息管理/修改干衣柜状态
  DEVICE_CHANGE_STATION:                      1004,         // 干衣柜综合管理/干衣柜信息管理/改变所属服务点
  DEVICE_FETCH_ALL_DEVICE:                    1005,         // 干衣柜综合管理/干衣柜信息管理/获取所有干衣柜
  DEVICE_FETCH_RELATED_DEVICE:                1006,         // 干衣柜综合管理/干衣柜信息管理/获取所管辖干衣柜

  /* 服务点综合管理 */
  STATION_BASE_QUERY:                         2000,         // 服务点综合管理/服务点信息管理/查看基本信息
  STATION_QUERY_PARTNER:                      2001,         // 服务点综合管理/服务点信息管理/查看分成方
  STATION_EDIT:                               2002,         // 服务点综合管理/服务点信息管理/编辑
  STATION_ADD:                                2003,         // 服务点综合管理/服务点信息管理/添加
  STATION_CHANGE_STATUS:                      2004,         // 服务点综合管理/服务点信息管理/修改服务点状态
  STATION_FETCH_ALL_STATION:                  2005,         // 服务点综合管理/投资人信息管理/获取所有服务点
  STATION_FETCH_RELATED_STATION:              2006,         // 服务点综合管理/投资人信息管理/获取关联服务点

  STATION_INVESTOR_BASE_QUERY:                2100,         // 服务点综合管理/投资人信息管理/查看基本信息
  STATION_INVESTOR_ADD:                       2101,         // 服务点综合管理/投资人信息管理/添加投资人
  STATION_INVESTOR_EDIT:                      2102,         // 服务点综合管理/投资人信息管理/编辑投资人
  STATION_INVESTOR_CHANGE_STATUS:             2103,         // 服务点综合管理/投资人信息管理/修改投资人可用状态
  STATION_FETCH_ALL_INVESTOR:                 2104,         // 服务点综合管理/投资人信息管理/获取所有投资人
  STATION_FETCH_RELATED_INVESTOR:             2105,         // 服务点综合管理/投资人信息管理/获取关联服务点投资人

  /* 充值与订单管理 */
  RECHARGE_ORDER_QUERY:                       3000,         // 充值与订单管理/订单信息管理/查看
  RECHARGE_MAN_USER_PAID:                     3100,         // 充值与订单管理/用户充值管理/

  /* 结算报表 */
  ACCOUNT_STAT_STATION_DIVIDEND:              4000,         // 结算报表/服务点分成统计/
  ACCOUNT_STATION_DEPARTMENT_DIVIDEND:        4100,         // 结算报表/服务单位分成结算/
  ACCOUNT_INVESTOR_DIVIDEND:                  4200,         // 结算报表/投资人分成结算/

  /* 营销活动 */
  MARKETING_MAN_ACTIVITY:                     5000,         // 营销活动/活动管理/
  MARKETING_PUBLISH_RECHARGE:                 5100,         // 营销活动/发布充值活动/
  MARKETING_PUBLISH_CREDIT:                   5200,         // 营销活动/发布积分倍率活动/
  MARKETING_PUBLISH_RED_PACKETS:              5300,         // 营销活动/发布红包活动/
  MARKETING_PUBLISH_CREDIT_EXCHANGE:          5400,         // 营销活动/发布积分兑换活动/

  /* 用户管理 */
  USER_MAN_USER_PROFILE:                      6000,         // 用户管理/用户信息管理/

  /* 消息推送 */
  PUSH_SYSTEM_MSG:                            7000,         // 消息推送/系统消息/
  PUSH_MARKETING_MSG:                         7100,         // 消息推送/营销类消息/

  /* 系统管理 */
  SYSMAN_MAN_USER_ROLE:                       8000,         // 系统管理/用户与角色管理/
  SYSMAN_MAN_OPER_LOG:                        8100,         // 系统管理/操作日志管理/

  /* 投资收益 */
  INVEST_PROFIT_MANAGER:                      9000,         // 投资收益/投资收益管理/
}