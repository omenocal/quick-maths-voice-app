'use strict';

exports.accountLinkingCard = () => ({ type: 'LinkAccount' });

exports.addressPermissionCard = () => ({
  type: 'AskForPermissionsConsent',
  permissions: [
    'read::alexa:device:all:address',
  ],
});

exports.answer = voxaEvent => voxaEvent.model.answer;

exports.number1 = voxaEvent => voxaEvent.model.number1;

exports.number2 = voxaEvent => voxaEvent.model.number2;

exports.operator = voxaEvent => voxaEvent.model.operator;

exports.operatorName = voxaEvent => voxaEvent.model.operatorName;

exports.points = voxaEvent => voxaEvent.model.user.data.points;

exports.pointsEarned = voxaEvent => voxaEvent.model.pointsEarned;
