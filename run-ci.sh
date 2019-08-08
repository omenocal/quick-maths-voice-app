#!/bin/bash
set -ev

mkdir .nyc_output

yarn run test-ci
yarn run report
yarn run lint
#npx nyc check-coverage

if [ "${CI:-}" = "true" ]; then
  cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js
fi
