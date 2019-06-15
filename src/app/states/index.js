'use strict';

const competitionStates = require('./competition.states');
const mainStates = require('./main.states');

function register(voxaApp) {
  competitionStates(voxaApp);
  mainStates(voxaApp);
}

module.exports = register;
