'use strict';

const _ = require('lodash');

function register(voxaApp) {
  voxaApp.onIntent('LaunchIntent', { to: 'launch' });
  voxaApp.onIntent('StartOverIntent', { to: 'launch' });
  voxaApp.onIntent('HelpIntent', { to: 'help' });
  voxaApp.onIntent('RepeatIntent', { to: 'repeat' });
  voxaApp.onIntent('CancelIntent', { to: 'exit' });
  voxaApp.onIntent('StopIntent', { to: 'exit' });

  voxaApp.onState('launch', async (voxaEvent) => {
    const isUserSubscribed = await voxaEvent.model.isUserSubscribed(voxaEvent);
    let reply = 'Launch.ReturningUser';

    if (voxaEvent.model.user.isFirstTime) {
      reply = 'Launch.FirstTimeUser';
    } else if (!isUserSubscribed) {
      if (voxaEvent.model.shouldSpeakReminder(1)) {
        reply = 'Launch.ReturningUserReminder1';
      } else if (voxaEvent.model.shouldSpeakReminder(2)) {
        reply = 'Launch.ReturningUserReminder2';
      } else if (voxaEvent.model.shouldSpeakReminder(3)) {
        reply = 'Launch.ReturningUserReminder3';
      }
    }

    return {
      reply,
      to: 'begin',
    };
  });

  voxaApp.onState('begin', (voxaEvent) => {
    const intentName = voxaEvent.intent.name;

    if (_.includes(['WelcomeIntent', 'YesIntent'], intentName)) {
      voxaEvent.model.selectOperation(voxaEvent);

      const response = voxaEvent.model.getOperationTemplate(voxaEvent);
      response.reply = 'Operation.Expression';
      response.to = 'result';

      return response;
    }

    if (intentName === 'NoIntent') {
      return { to: 'exit' };
    }
  });

  voxaApp.onState('result', (voxaEvent) => {
    const intentName = voxaEvent.intent.name;

    if (intentName === 'RepeatIntent') {
      return { to: 'repeat' };
    }

    const result = _.toInteger(
      (voxaEvent.intent.params.number || '').toLowerCase(),
    );

    const response = voxaEvent.model.getResultTemplate(voxaEvent);
    response.reply = 'Operation.WrongAnswer';
    response.to = 'begin';

    if (voxaEvent.model.isAnswerRight(result)) {
      response.reply = ['Operation.RightAnswerExpression', 'Operation.RightAnswer'];
    }

    return response;
  });

  voxaApp.onState('repeat', (voxaEvent) => {
    if (voxaEvent.session.new || !voxaEvent.model.reply || voxaEvent.model.reply.to === 'die') {
      return { to: 'launch' };
    }

    const intentName = voxaEvent.intent.name;
    const lastAlexaAPLTemplate = _.get(voxaEvent, 'model.reply.alexaAPLTemplate');
    const lastReply = _.get(voxaEvent, 'model.reply.say');
    const lastReprompt = _.get(voxaEvent, 'model.reply.reprompt');
    const sayReply = _.isArray(lastReply) ? _.last(lastReply) : lastReply || [];
    const to = _.get(voxaEvent, 'model.reply.to');

    const finalResponse = {
      flow: 'yield',
      to,
    };

    if (!_.isEmpty(lastAlexaAPLTemplate)) {
      finalResponse.alexaAPLTemplate = lastAlexaAPLTemplate;
    }

    if (!_.isEmpty(lastReprompt)) {
      finalResponse.reprompt = lastReprompt;

      if (intentName !== 'RepeatIntent') {
        finalResponse.say = lastReprompt;
      }
    }

    if (intentName === 'RepeatIntent' && !_.isEmpty(sayReply)) {
      finalResponse.say = sayReply;
    }

    return finalResponse;
  });

  voxaApp.onState('help', {
    reply: 'Help',
    to: 'repeat',
  });

  voxaApp.onState('exit', (voxaEvent) => {
    let reply = 'Exit';

    if (voxaEvent.model.user.isFirstTime) {
      reply = 'ExitFirstTime';
    }

    return {
      reply,
      to: 'die',
    };
  });
}

module.exports = register;
