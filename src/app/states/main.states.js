'use strict';

function register(voxaApp) {
  voxaApp.onIntent('LaunchIntent', {
    reply: 'Launch.FirstTimeUser',
    to: 'entry',
  });
}

module.exports = register;
