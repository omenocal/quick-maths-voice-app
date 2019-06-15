'use strict';

const config = require('../../config');

function register(voxaApp) {
  voxaApp.onIntent('EnterCompetitionIntent', { to: 'competition' });

  voxaApp.onIntent('Connections.Response', (voxaEvent) => {
    if (voxaEvent.rawEvent.request.payload.purchaseResult === 'ACCEPTED') {
      return {
        reply: 'Competition.SubscriptionAccepted',
        to: 'begin',
      };
    }

    return {
      reply: 'Competition.IspRejected',
      to: 'begin',
    };
  });

  voxaApp.onState('competition', async (voxaEvent) => {
    if (voxaEvent.model.isUserInCompetition()) {
      return {
        reply: 'Competition.AlreadyIn',
        to: 'begin',
      };
    }

    if (!voxaEvent.user.accessToken) {
      return {
        alexaCard: 'Competition.AccountLinkingCard',
        reply: 'Competition.AccountLink',
        to: 'die',
      };
    }

    const userInfo = await voxaEvent.getUserInformation();
    voxaEvent.model.saveUserInfo(userInfo);

    try {
      const info = await voxaEvent.alexa.deviceAddress.getAddress();
      voxaEvent.model.saveUserAddress(info);
    } catch (err) {
      console.log('err', err);

      return {
        alexaCard: 'Competition.AddressPermissionCard',
        reply: 'Competition.AddressPermission',
        to: 'die',
      };
    }

    const token = 'afterBuyingSubscription';
    const buyDirective = await voxaEvent.alexa.isp.buyByReferenceName(
      config.alexa.subscriptionId,
      token,
    );

    return {
      alexaConnectionsSendRequest: buyDirective,
    };
  });
}

module.exports = register;
