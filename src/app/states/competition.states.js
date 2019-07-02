'use strict';

const _ = require('lodash');

const config = require('../../config');

function register(voxaApp) {
  voxaApp.onIntent('EnterCompetitionIntent', { to: 'competition' });

  voxaApp.onIntent('CompetitionPositionIntent', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);

    if (!isUserSubscribed) {
      return {
        reply: 'Competition.NotRegistered',
        to: 'begin',
      };
    }

    const response = await voxaEvent.model.loadUserPosition(voxaEvent);

    response.reply = 'Competition.Position';
    response.to = 'begin';

    return response;
  });

  voxaApp.onIntent('RefundIntent', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);

    if (!isUserSubscribed) {
      return {
        reply: 'Competition.Refund.NotSubscribed',
        to: 'begin',
      };
    }

    if (voxaEvent.alexa) {
      return {
        reply: 'Competition.Refund.Confirm',
        to: 'confirmAlexaRefund',
      };
    }

    const reply = ['Competition.Refund.GoogleMoreInformation'];
    const screen = 'actions.capability.SCREEN_OUTPUT';
    const hasScreen = _.includes(voxaEvent.supportedInterfaces, screen);

    if (!hasScreen) {
      reply.push('Competition.Refund.GoogleMoreInformationScreen');
    }

    reply.push('Competition.StartGame');

    const locale = voxaEvent.request.locale.split('-')[0];
    const url = `https://support.google.com/googleplay/answer/2479637?hl=${locale}&ref_topic=3364671`;

    return {
      dialogflowLinkOutSuggestion: {
        name: voxaEvent.t('Competition.Refund.GooglePlayHelp'),
        url,
      },
      reply,
      to: 'begin',
    };
  });

  voxaApp.onIntent('RemainingDaysIntent', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);

    const reply = ['Competition.RemainingDays'];

    if (!isUserSubscribed) {
      reply.push('Competition.SubscriptionReminder');
    }

    reply.push('Competition.StartGame');

    return {
      reply,
      to: 'begin',
    };
  });

  voxaApp.onIntent('ScoreIntent', (voxaEvent) => {
    const reply = voxaEvent.model.hasPoints() ? 'Competition.Score' : 'Competition.NoScore';

    return {
      reply,
      to: 'begin',
    };
  });

  voxaApp.onIntent('WhatCanIBuyIntent', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);
    const reply = isUserSubscribed ? 'Competition.WhatCanIBuy' : 'Competition.WhatCanIBuyNotSubscribed';

    return {
      reply,
      to: 'begin',
    };
  });

  voxaApp.onIntent('WhatDidIBuyIntent', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);
    const reply = isUserSubscribed ? 'Competition.WhatDidIBuy' : 'Competition.WhatDidIBuyNotSubscribed';

    return {
      reply,
      to: 'begin',
    };
  });

  voxaApp.onIntent('CompletePermissionIntent', (voxaEvent) => {
    const { device } = voxaEvent.rawEvent.originalDetectIntentRequest.payload;
    const city = _.get(device, 'location.city') || '';
    const { latitude, longitude } = _.get(device, 'location.coordinates') || {};

    if (latitude && longitude) {
      voxaEvent.model.saveUserAddress({
        city,
        latitude,
        longitude,
      });

      return {
        to: 'competition',
      };
    }

    return {
      reply: 'Competition.SignUp.PermissionDenied',
      to: 'begin',
    };
  });

  voxaApp.onIntent('CompleteSignInIntent', async (voxaEvent) => {
    let userInfo;

    if (voxaEvent.model.isUserLoggedIn(voxaEvent)) {
      userInfo = await voxaEvent.getUserInformation();
    }

    if (userInfo) {
      voxaEvent.model.saveUserInfo(userInfo);

      return {
        to: 'competition',
      };
    }

    return {
      reply: 'Competition.SignUp.AccountDenied',
      to: 'begin',
    };
  });

  voxaApp.onIntent('CompletePurchaseIntent', (voxaEvent) => {
    const purchaseStatus = voxaEvent.google.digitalGoods.getPurchaseStatus();
    console.log('COMPLETE_PURCHASE CompletePurchaseIntent', purchaseStatus);

    if (voxaEvent.google.digitalGoods.isPurchaseStatusChangeRequested()) {
      return {
        to: 'competition',
      };
    }

    const label = purchaseStatus
      .replace('PURCHASE_STATUS_', '')
      .replace(/_/g, '')
      .toLowerCase();

    if (voxaEvent.google.digitalGoods.isPurchaseStatusOk()) {
      return {
        reply: [`Competition.PurchaseStatus.${label}`, 'Competition.Accepted'],
        to: 'begin',
      };
    }

    return {
      reply: [`Competition.PurchaseStatus.${label}`, 'Competition.PurchaseStatusFollowUp'],
      to: 'begin',
    };
  });

  voxaApp.onIntent('Connections.Response', (voxaEvent) => {
    const { name } = voxaEvent.rawEvent.request;

    // THE USER ACCEPTED TO BUY OR CANCEL THE SUBSCRIPTION
    if (voxaEvent.rawEvent.request.payload.purchaseResult === 'ACCEPTED') {
      // ACCEPTS CANCELLING THE SUBSCRIPTION
      if (name === 'Cancel') {
        voxaEvent.model.user.cancelSubscription();

        return {
          reply: 'Competition.Refund.YesToAlexa',
          to: 'begin',
        };
      }

      return {
        reply: 'Competition.SubscriptionAccepted',
        to: 'begin',
      };
    }

    // THE USER REJECTED TO CANCEL THE SUBSCRIPTION
    if (name === 'Cancel') {
      return {
        reply: 'Competition.Refund.NotToAlexa',
        to: 'begin',
      };
    }

    // THE USER REJECTED TO BUY THE SUBSCRIPTION
    return {
      reply: 'Competition.IspRejected',
      to: 'begin',
    };
  });

  voxaApp.onState('competition', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);

    if (isUserSubscribed) {
      return {
        reply: 'Competition.AlreadyIn',
        to: 'begin',
      };
    }

    if (!voxaEvent.model.isUserLoggedIn(voxaEvent)) {
      if (voxaEvent.alexa) {
        return {
          alexaCard: 'Competition.AccountLinkingCard',
          reply: 'Competition.AccountLinkAlexa',
          to: 'die',
        };
      }

      return {
        dialogflowAccountLinkingCard: 'Competition.AccountLinkGoogle.tell',
        to: 'die',
      };
    }

    const userInfo = await voxaEvent.getUserInformation();
    voxaEvent.model.saveUserInfo(userInfo);

    if (voxaEvent.alexa) {
      try {
        const info = await voxaEvent.alexa.deviceAddress.getAddress();
        voxaEvent.model.saveUserAddress(info);
      } catch (err) {
        console.log('competition err', err);

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
    }

    if (voxaEvent.google) {
      if (!voxaEvent.model.user.data.city) {
        return {
          dialogflowPermission: {
            context: voxaEvent.t('Competition.SignUp.Location'),
            permissions: [
              'DEVICE_PRECISE_LOCATION',
              'DEVICE_COARSE_LOCATION',
            ],
          },
        };
      }

      const product = await voxaEvent.model.getProduct(voxaEvent);
      const { skuId } = product;

      return {
        googleCompletePurchase: { skuId },
      };
    }
  });

  voxaApp.onState('confirmAlexaRefund', async (voxaEvent) => {
    const intentName = voxaEvent.intent.name;

    if (intentName === 'YesIntent') {
      const token = 'afterCancelSubscription';
      const cancelDirective = await voxaEvent.alexa.isp.cancelByReferenceName(
        config.alexa.subscriptionId,
        token,
      );

      return {
        alexaConnectionsSendRequest: cancelDirective,
      };
    }

    if (intentName === 'NoIntent') {
      return {
        reply: 'Competition.Refund.NotCancel',
        to: 'begin',
      };
    }
  });
}

module.exports = register;
