'use strict';

exports.accountLinkingCard = () => ({ type: 'LinkAccount' });

exports.addressPermissionCard = () => ({
  type: 'AskForPermissionsConsent',
  permissions: [
    'read::alexa:device:all:address',
  ],
});

exports.answer = (voxaEvent) => voxaEvent.model.answer;

exports.number1 = (voxaEvent) => voxaEvent.model.number1;

exports.number2 = (voxaEvent) => voxaEvent.model.number2;

exports.operator = (voxaEvent) => voxaEvent.model.operator;

exports.operatorName = (voxaEvent) => voxaEvent.model.operatorName;

exports.pointsEarned = (voxaEvent) => voxaEvent.model.pointsEarned;

exports.position = (voxaEvent) => voxaEvent.model.position;

exports.totalPlayers = (voxaEvent) => voxaEvent.model.totalPlayers;

exports.totalPoints = (voxaEvent) => {
  const count = voxaEvent.model.totalPoints;

  return voxaEvent.t('Competition.Score.points', { count });
};

exports.timeRemaining = (voxaEvent) => voxaEvent.model.getTimeRemaining();
