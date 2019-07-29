#!/bin/bash
set -ev

yarn run test
yarn run report
yarn run lint
npx nyc check-coverage

if [ "${CI:-}" = "true" ]; then
  yarn add coveralls
  cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js
fi
