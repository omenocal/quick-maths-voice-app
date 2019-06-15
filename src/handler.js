'use strict';

const { alexaSkill, assistantAction } = require('./app');

exports.alexaHandler = alexaSkill.lambda();
exports.assistantHandler = assistantAction.lambdaHTTP();
