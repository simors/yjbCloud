import AV from 'leanengine';
import {wechat_api} from '../../mpFuncs/index';
import {authListOpenIds, AUTH_USER_STATUS} from '../Auth/User';
import * as errno from '../errno';

async function getFollowers(nextOpenId) {
  const iterator = {openIds: [], nextOpenId: '', error: undefined};

  return new Promise((resolve) => {
    wechat_api.getFollowers(nextOpenId, (err, result) => {
      if (err) {
        iterator.error = err;
        resolve(iterator);
      }

      if (result.count > 0) {
        iterator.openIds = result.data.openid;
        iterator.nextOpenId = result.next_openid;
      }

      resolve(iterator);
    });
  });
}

async function massSendText(content, openIds) {
  return new Promise((resolve, reject) => {
    if (openIds.length === 1) {
      openIds.push('');
    }

    wechat_api.massSendText(content, openIds, (err, result) => {
      if (err) {
        console.log('send notification failed: ', err);
      }

      resolve();
    });
  });
}

async function sendSystemNotification(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {content} = params;

  let iterator = {openIds: [], nextOpenId: '', error: undefined};
  do {
    iterator = await getFollowers(iterator.nextOpenId);
    if (iterator.error) {
      console.log('wechat api getFollowers fails, error: ', iterator.error);
      break;
    }

    if (iterator.openIds.length === 0) {
      break;
    }

    console.log('iterator: ', iterator);

    // iterate followers
    let more = true;
    let begin = 0, end = 0;
    const kStep = 10;
    while (more) {
      end = begin + kStep;
      if (end >= iterator.openIds.length) {
        end = iterator.openIds.length;
        more = false;
      }

      const openIds = iterator.openIds.slice(begin, end);
      begin = end;

      console.log('openids: ', openIds);
      await massSendText(content, openIds);
    }
  } while (!iterator.error && iterator.nextOpenId);

  if (iterator.error) {
    iterator.error.code = errno.EIO;
    throw iterator.error;
  }
}

async function sendPromotionNotification(req) {
  const {currentUser, params} = req;

  if (!currentUser) {
    // no token provided
    throw new AV.Cloud.Error('Permission denied, need to login first', {code: errno.EPERM});
  }

  const {limit=100, content, province, city} = params;

  const mpStatus = AUTH_USER_STATUS.MP_NORMAL;
  const filters = {limit, province, city, mpStatus};

  if (province === undefined && city === undefined) {
    return await sendSystemNotification(req);
  }

  let openIds = undefined;
  let more = true;
  while (more) {
    ({openIds, lastUpdatedAt: filters.lastUpdatedAt} = await authListOpenIds(filters));

    if (openIds.length === 0) {
      break;
    }

    if (openIds.length < limit) {
      more = false;
    }

    await massSendText(content, openIds);
  }
}

const notificationApi = {
  sendSystemNotification,
  sendPromotionNotification,
};

module.exports = notificationApi;
