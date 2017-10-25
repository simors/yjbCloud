import AV from 'leanengine';
import {wechat_api} from '../../mpFuncs/index';
import {authListOpenIds, AUTH_USER_STATUS} from '../Auth/User';
import * as errno from '../errno';

async function sendNotification(params) {
  const {limit=100, content, province, city} = params;

  const callback = (err, result) => {
    if (err) {
      console.log('send notification failed: ', err);
    }
  };

  let openIds = undefined;

  const mpStatus = AUTH_USER_STATUS.MP_NORMAL;
  const filters = {limit, province, city, mpStatus};

  let more = true;
  while (more) {
    ({openIds, lastUpdatedAt: filters.lastUpdatedAt} = await authListOpenIds(filters));
    console.log('openIds: ', openIds);

    if (openIds.length === 0) {
      console.log('break');
      break;
    }

    if (openIds.length < limit) {
      more = false;
    }

    if (openIds.length === 1) {
      openIds.push('');
    }

    wechat_api.massSendText(content, openIds, callback);
  }
}

async function sendSystemNotification(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  await sendNotification(params);
}

async function sendPromotionNotification(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  await sendNotification(params);
}

const notificationApi = {
  sendSystemNotification,
  sendPromotionNotification,
};

module.exports = notificationApi;
