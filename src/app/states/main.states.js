'use strict';

const _ = require('lodash');

function register(voxaApp) {
  voxaApp.onIntent('LaunchIntent', { to: 'launch' });
  voxaApp.onIntent('StartOverIntent', { to: 'launch' });
  voxaApp.onIntent('CancelIntent', { to: 'exit' });
  voxaApp.onIntent('StopIntent', { to: 'exit' });

  voxaApp.onState('launch', (voxaEvent) => {
    let reply = 'Launch.ReturningUser';

    if (voxaEvent.model.user.isFirstTime) {
      reply = 'Launch.FirstTimeUser';
    } else if (voxaEvent.model.shouldSpeakReminder(1)) {
      reply = 'Launch.ReturningUserReminder1';
    } else if (voxaEvent.model.shouldSpeakReminder(2)) {
      reply = 'Launch.ReturningUserReminder2';
    } else if (voxaEvent.model.shouldSpeakReminder(3)) {
      reply = 'Launch.ReturningUserReminder3';
    }

    return {
      reply,
      to: 'begin',
    };
  });

  voxaApp.onState('begin', (voxaEvent) => {
    const intentName = voxaEvent.intent.name;

    if (intentName === 'YesIntent') {
      voxaEvent.model.selectOperation(voxaEvent);

      return {
        reply: 'Operation.Expression',
        to: 'result',
      };
    }

    if (intentName === 'NoIntent') {
      return { to: 'exit' };
    }
  });

  voxaApp.onState('result', (voxaEvent) => {
    const result = _.toInteger(
      (voxaEvent.intent.params.number || '').toLowerCase(),
    );

    if (voxaEvent.model.isAnswerRight(result)) {
      return {
        reply: ['Operation.RightAnswerExpression', 'Operation.RightAnswer'],
        to: 'begin',
      };
    }

    return {
      reply: 'Operation.WrongAnswer',
      to: 'begin',
    };
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
