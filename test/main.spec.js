'use strict';

const _ = require('lodash');
const mime = require('alexa-mime');
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const nock = require('nock');
const path = require('path');
const simple = require('simple-mock');
const { alexaSkill } = require('../src/app');
const views = require('../src/languageResources/views');

AWSMock.setSDKInstance(AWS);

const describeWrapper = {
  clear: () => {
    AWSMock.restore('');
    simple.restore();
    nock.cleanAll();
  },
  launch: () => {
    simple.mock(_, 'random').returnWith(5);
    simple.mock(_, 'sample', _.head);

    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
      cb(undefined, {});
    });
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
      cb(undefined, {});
    });
    AWSMock.mock('DynamoDB.DocumentClient', 'scan', (params, cb) => {
      cb(undefined, { Items: [] });
    });

    const reqheaders = {
      reqheaders: {
        Authorization: 'Bearer undefined',
      },
    };

    nock('https://api.amazonalexa.com', reqheaders)
      .persist()
      .get('//v1/devices/amzn1.ask.device.VOID/settings/address')
      .reply(200, {})
      .get('//v1/users/~current/skills/~current/inSkillProducts')
      .reply(200, {});
  },
};

mime(
  { handler: alexaSkill.lambda() },
  views.en.translation,
  path.join(__dirname, 'use-cases'),
  path.join(__dirname, '..', 'reports', 'simulate'),
  describeWrapper,
);
