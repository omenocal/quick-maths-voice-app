'use strict';

const AWS = require('aws-sdk');
const https = require('https');
const _ = require('lodash');
const path = require('path');

const env = process.env.NODE_ENV || 'local';

const configFile = require(path.join(__dirname, `${env}.json`));
configFile.env = env;

AWS.config.update(_.merge(
  {
    httpOptions: {
      /**
       * See known issue: https://github.com/aws/aws-sdk-js/issues/862
       */
      agent: new https.Agent({
        ciphers: 'ALL',
        keepAlive: false,
        rejectUnauthorized: true,
        secureProtocol: 'TLSv1_method',
      }),
      timeout: 4000,
    },
    maxRetries: 8,
    region: 'us-east-1',
  },
  configFile.aws,
));

module.exports = configFile;
module.exports.asFunction = () => configFile;
