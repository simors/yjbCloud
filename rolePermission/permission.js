/**
 * Created by yangyang on 2017/10/20.
 */

export const PERMISSION_CODE = {
  /* 干衣柜综合管理 */
  DEVICE_QUERY_INFO:                          1000,         // 干衣柜综合管理/干衣柜信息管理/查看
  /* 服务点综合管理 */
  STATION_QUERY_INFO:                         2000,         // 服务点综合管理/服务点信息管理/查看
  STATION_MAN_INVESTOR:                       2100,         // 服务点综合管理/投资人信息管理/

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
  MARKETING_PUBLISH_CREDIT:                   5200,         // 营销活动/发布积分活动/
  MARKETING_PUBLISH_RED_PACKETS:              5300,         // 营销活动/发布红包活动/

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