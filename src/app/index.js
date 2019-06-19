'use strict';

const _ = require('lodash');
const {
  AlexaPlatform,
  GoogleAssistantPlatform,
  plugins,
  VoxaApp,
} = require('voxa');
const voxaDashbot = require('voxa-dashbot').register;
const voxaGA = require('voxa-ga');
const config = require('../config');
const Model = require('./model');
const User = require('../services/User');
const states = require('./states');
const variables = require('./variables');
const views = require('../languageResources/views');

let environment = process.env.NODE_ENV || 'staging';

if (environment === 'local.example') {
  environment = 'staging';
}

const defaultFulfillIntents = require(`../content/${environment}-canfulfill-intents.json`);

const voxaApp = new VoxaApp({
  Model, views, variables, defaultFulfillIntents,
});
states(voxaApp);

const googleConfig = {
  transactionOptions: {
    // Replacing android package name with env variable for privacy since the repo is public
    androidAppPackageName: process.env.ANDROID_PACKAGE_NAME || config.google.androidPackageName,
    keyFile: './client_secret.json',
  },
};

exports.alexaSkill = new AlexaPlatform(voxaApp);
exports.assistantAction = new GoogleAssistantPlatform(voxaApp, googleConfig);

// Replacing Dashbot keys with env variables for privacy since the repo is public
config.dashbot.alexa = process.env.DASHBOT_ALEXA_KEY || config.dashbot.alexa;
config.dashbot.google = process.env.DASHBOT_GOOGLE_ACTION_KEY || config.dashbot.google;
config.googleAnalytics.trackingId = process.env.GA_TRACKING_ID || config.googleAnalytics.trackingId;

plugins.replaceIntent(voxaApp);
voxaDashbot(voxaApp, config.dashbot);
voxaGA(voxaApp, config.googleAnalytics);

/**
 * Load User into the model
 */
voxaApp.onRequestStarted(async (voxaEvent) => {
  const user = await User.get(voxaEvent);

  voxaEvent.model.user = user;

  const userInfo = await voxaEvent.getUserInformation();
  voxaEvent.model.saveUserInfo(userInfo);

  if (voxaEvent.alexa) {
    try {
      const info = await voxaEvent.alexa.deviceAddress.getAddress();
      voxaEvent.model.saveUserAddress(info);
    } catch (err) {
      console.log('competition err', err);
    }
  }
});

/**
 * Update the session count
 */
voxaApp.onSessionStarted((voxaEvent) => {
  const { user } = voxaEvent.model;
  user.newSession();
});

/**
 * Save the user
 */
voxaApp.onBeforeReplySent(async (voxaEvent, reply, transition) => {
  const { user } = voxaEvent.model;

  await user.save({ userId: voxaEvent.user.userId });

  voxaEvent.model.reply = _.pickBy({
    dialogflowLinkOutSuggestion: transition.dialogflowLinkOutSuggestion,
    dialogflowSuggestions: transition.dialogflowSuggestions,
    directives: transition.directives,
    flow: transition.flow,
    reprompt: transition.reprompt,
    say: transition.say,
    to: transition.to,
  });
});

voxaApp.onUnhandledState((voxaEvent) => {
  if (voxaEvent.session.new || !voxaEvent.model.reply || voxaEvent.model.reply.to === 'die') {
    return { to: 'launch' };
  }

  const lastReply = voxaEvent.model.reply.say;
  const lastReprompt = _.get(voxaEvent, 'model.reply.reprompt');
  const dialogflowLinkOutSuggestion = _.get(voxaEvent, 'model.reply.dialogflowLinkOutSuggestion');
  const dialogflowSuggestions = _.get(voxaEvent, 'model.reply.dialogflowSuggestions');
  const directives = _.get(voxaEvent, 'model.reply.directives');
  let reply = _.isArray(lastReply) ? _.last(lastReply) : lastReply;
  reply = _.filter(_.concat('Fallback.NotUnderstood.say', reply));

  const response = {
    dialogflowLinkOutSuggestion,
    dialogflowSuggestions,
    directives,
    flow: 'yield',
    reprompt: lastReprompt,
    say: reply,
    to: voxaEvent.model.reply.to,
  };

  return response;
});

voxaApp.onError((voxaEvent, error, reply) => {
  console.log('error', error);

  const statement = _.head(voxaEvent.t('Error.tell', { returnObjects: true }));

  reply.clear();
  reply.addStatement(statement);
  reply.terminate();

  return reply;
}, true);

exports.voxaApp = voxaApp;
