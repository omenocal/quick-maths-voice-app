'use strict';

const _ = require('lodash');
const moment = require('moment-timezone');
const ntw = require('number-to-words');
const readingTime = require('reading-time');

const levels = require('../content/levels');
const operators = require('../content/operators');

class Model {
  constructor(data = {}) {
    _.assign(this, data);
    this.sessionCorrect = 0;
    this.sessionIncorrect = 0;
  }

  isAnswerRight(result) {
    const isRight = result === this.answer;

    if (isRight) {
      const today = +new Date();
      const timeDiff = today - this.dateStart - this.speechTimeDiff;
      let pointsEarned = this.user.points || 0;

      console.log('today', today);
      console.log('dateStart', this.dateStart);
      console.log('speechTimeDiff', this.speechTimeDiff);
      console.log('timeDiff', timeDiff);

      if (timeDiff <= 3000) {
        pointsEarned += 10;
      } else if (timeDiff <= 6000) {
        pointsEarned += 8;
      } else if (timeDiff <= 9000) {
        pointsEarned += 4;
      } else {
        pointsEarned += 2;
      }

      console.log('pointsEarned', pointsEarned);

      this.pointsEarned = pointsEarned;
      this.user.data.points = pointsEarned;

      this.sessionCorrect += 1;
    } else {
      this.sessionIncorrect += 1;
    }

    return isRight;
  }

  getCompetitiondId() {
    const { timezone } = this.user.data;
    const competitionId = moment().tz(timezone).format('YYYY-MM');

    return competitionId;
  }

  isUserInCompetition() {
    const competitionId = this.getCompetitiondId();
    const { competitions, isCanceled } = this.user.data;
    const currentCompetition = _.find(competitions, { competitionId });

    return !_.isUndefined(currentCompetition) && !isCanceled;
  }

  saveUserAddress(info) {
    this.user.data.city = info.city;
    this.user.data.countryCode = info.countryCode;
  }

  saveUserInfo(info) {
    this.user.data.email = info.email;
    this.user.data.name = info.name;
    this.user.data.zipCode = info.zipCode;
  }

  selectOperation(voxaEvent) {
    if (this.user.isFirstTime) {
      this.level = _.head(levels);
    } else if (this.user.sessionCount <= 3) {
      this.level = _.nth(levels, this.user.sessionCount);
    } else {
      this.level = _.sample(levels);
    }

    const selectedOperator = _.sample(operators);

    this.operator = selectedOperator.operator;
    this.operatorName = selectedOperator.name;

    this.number1 = _.random(this.level.lowLimit, this.level.highLimit);
    this.number2 = _.random(this.level.lowLimit, this.level.highLimit);

    // AVERAGE TIME THAT A LAMBDA FUNCTION LASTS TO RECEIVE AND SEND INFORMATION
    // TO THE ALEXA SERVICE. WHEN TRYING TO TEST LOCALLY, THE AMOUNT VARIES A LOT
    // DEPENDING ON THE LOCAL MACHINE AND THE INTERNET CONNECTION.
    this.speechTimeDiff = 1500;

    // IF IT'S A "TIMES" OR "DIVIDED BY" OPERATIONS, WE WILL ONLY ALLOW OPERATIONS
    // BETWEEN A LIMITED NUMBER BY THE LEVEL AND A NUMBER BETWEEN 0 AND 9
    if (_.includes(['*', '/'], this.operator)) {
      this.number2 = _.random(0, 9);
    }

    if (this.operator === '+') {
      this.answer = this.number1 + this.number2;
    }

    if (this.operator === '-') {
      // WE WILL NOT ALLOW NEGATIVE RESULTS
      if (this.number2 > this.number1) {
        const temp = this.number1;

        this.number1 = this.number2;
        this.number2 = temp;
      }

      this.answer = this.number1 - this.number2;
    }

    if (this.operator === '*') {
      this.answer = this.number1 * this.number2;
    }

    if (this.operator === '/') {
      let checkAgain = true;

      while (checkAgain) {
        this.number1 = _.random(this.level.lowLimit, this.level.highLimit);

        // FOR "DIVIDED BY" OPERATIONS, WE WILL ONLY DIVIDE BY NUMBERS BETWEEN 1 AND 9
        this.number2 = _.random(1, 9);

        this.answer = this.number1 / this.number2;

        checkAgain = _.includes(this.answer.toString(), '.');
      }
    }

    const wordsNumber1 = ntw.toWords(this.number1);
    const wordsNumber2 = ntw.toWords(this.number2);
    const params = {
      operatorName: this.operatorName,
      wordsNumber1,
      wordsNumber2,
    };

    const speech = voxaEvent.t('Operation.Expression.calculation', params);
    const durationTime = readingTime(speech);

    console.log('speech', speech);
    console.log('durationTime', durationTime);

    this.speechTimeDiff += durationTime.time;

    this.dateStart = +new Date();
  }

  shouldSpeakReminder(reminderCount) {
    return this.user.data.reminderCount === reminderCount + 1;
  }

  static deserialize(data) {
    return new this(data);
  }

  serialize() {
    return this;
  }
}

module.exports = Model;
