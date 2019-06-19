'use strict';

const _ = require('lodash');
const moment = require('moment-timezone');
const ntw = require('number-to-words');
const readingTime = require('reading-time');
const voxa = require('voxa');

const backgroundWithLeaderboardData = require('./aplTemplates/backgroundWithLeaderboard/data');
const backgroundWithLeaderboardDocument = require('./aplTemplates/backgroundWithLeaderboard/document');
const config = require('../config');
const levels = require('../content/levels');
const operators = require('../content/operators');

const { DisplayTemplate } = voxa;

class Model {
  constructor(data = {}) {
    _.assign(this, data);
    this.sessionCorrect = 0;
    this.sessionIncorrect = 0;
  }

  isAnswerRight(result) {
    const isRight = result === this.answer;
    const competitiondId = this.getCompetitiondId();

    if (isRight) {
      const today = +new Date();
      const timeDiff = today - this.dateStart - this.speechTimeDiff;
      let pointsEarned = 0;

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

      pointsEarned *= this.level.pointsMultiplier;

      console.log('points after multiplier', pointsEarned);

      this.pointsEarned = pointsEarned;
      this.user.addPoints(competitiondId, pointsEarned);

      this.sessionCorrect += 1;
    } else {
      this.sessionIncorrect += 1;

      this.user.removePoints(competitiondId);
    }

    return isRight;
  }

  getCompetitiondId() {
    const { timezone } = this.user.data;

    if (timezone) {
      return moment().tz(timezone).format('YYYY-MM');
    }

    return moment().format('YYYY-MM');
  }

  getCurrentPoints() {
    const competitionId = this.getCompetitiondId();

    return this.user.getCurrentPoints(competitionId);
  }

  // eslint-disable-next-line class-methods-use-this
  async getItemsInPlayStore(voxaEvent) {
    try {
      const result = await voxaEvent.google.digitalGoods.getSubscriptions(config.google.skus);

      console.log('getItemsInPlayStore result', JSON.stringify(result, null, 2));

      return _.head(result.skus);
    } catch (err) {
      console.log('getItemsInPlayStore err', err);
      throw err;
    }
  }

  async getProduct(voxaEvent) {
    if (voxaEvent.alexa) {
      return voxaEvent.alexa.isp.getProductByReferenceName(config.alexa.subscriptionId);
    }

    const { packageName } = config.google;

    const { packageEntitlements } = voxaEvent.rawEvent.originalDetectIntentRequest.payload.user;
    console.log('packageEntitlements', JSON.stringify(packageEntitlements, null, 2));

    const entitlement = _.find(packageEntitlements, { packageName });
    const subscription = _.find(entitlement, { sku: _.head(config.google.skus) });
    const autoRenewing = _.get(subscription, 'inAppDetails.inAppPurchaseData.autoRenewing');
    const productFromStore = await this.getItemsInPlayStore(voxaEvent);

    console.log('autoRenewing', autoRenewing);

    if (entitlement) {
      productFromStore.entitled = 'ENTITLED';
    }

    return productFromStore;
  }

  getTimeRemaining() {
    const { timezone } = this.user.data;
    let today = moment();

    if (timezone) {
      today = moment().tz(timezone);
    }

    const endOfMonth = today.clone().endOf('month').endOf('day');
    const daysDiff = endOfMonth.diff(today, 'days');
    const hoursDiff = endOfMonth.diff(today, 'hours');
    const minutesDiff = endOfMonth.diff(today, 'minutes');

    if (hoursDiff < 1) {
      return moment.duration(minutesDiff, 'minutes').humanize(true);
    }

    if (daysDiff < 1) {
      return moment.duration(hoursDiff, 'hours').humanize(true);
    }

    return moment.duration(daysDiff, 'days').humanize(true);
  }

  hasPoints() {
    const competitionId = this.getCompetitiondId();

    return this.user.hasPoints(competitionId);
  }

  async isUserSubscribed(voxaEvent) {
    const product = await this.getProduct(voxaEvent);

    return product.entitled === 'ENTITLED';
  }

  async loadUserPosition(voxaEvent) {
    const competitionId = this.getCompetitiondId();
    const allUsers = await this.user.getAllUsersInChallenge();
    const [
      position,
      totalPoints,
      totalPlayers,
    ] = await this.user.getUserPosition(competitionId, allUsers);

    this.position = position;
    this.totalPlayers = totalPlayers;
    this.totalPoints = totalPoints;

    return this.showWinnersDashboard(voxaEvent, allUsers, competitionId);
  }

  saveUserAddress(info) {
    this.user.saveUserAddress(info);
  }

  saveUserInfo(info) {
    this.user.saveUserInfo(info);
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

  // eslint-disable-next-line class-methods-use-this
  showWinnersDashboard(voxaEvent, allUsers, competitionId) {
    const playerArray = _(_.cloneDeep(allUsers))
      .map((x) => {
        const player = _.find(x.competitions, { competitionId });

        if (!player) {
          return undefined;
        }

        player.count = player.score;
        player.name = _.capitalize(_.words(x.name || 'Anonymous')[0]);
        player.city = _.capitalize(x.city) || voxaEvent.request.locale.split('-')[1];

        delete player.score;
        return player;
      })
      .compact()
      .orderBy(['count'], ['desc'])
      .take(10)
      .value();
    const reply = {};

    if (_.isEmpty(playerArray)) {
      return reply;
    }

    if (voxaEvent.google) {
      const columns = [
        voxaEvent.t('Competition.TableHeaders.Position'),
        voxaEvent.t('Competition.TableHeaders.Player'),
        voxaEvent.t('Competition.TableHeaders.City'),
        voxaEvent.t('Competition.TableHeaders.Victories'),
      ];

      const rows = [];

      _.forEach(playerArray, (item, key) => {
        rows.push([(key + 1).toString(), item.name, item.city, item.count.toString()]);
      });

      reply.dialogflowTable = {
        columns,
        rows,
        title: voxaEvent.t('Competition.ResultsTitle'),
      };
    }

    const hasAPLInterface = _.includes(voxaEvent.supportedInterfaces, 'Alexa.Presentation.APL');
    const hasScreenInterface = _.includes(voxaEvent.supportedInterfaces, 'Display');

    if (hasAPLInterface) {
      const datasources = _.cloneDeep(backgroundWithLeaderboardData);
      const documentTemplate = _.cloneDeep(backgroundWithLeaderboardDocument);
      const listItems = _.map(playerArray, (item, key) => ({
        listItemIdentifier: key + 1,
        ordinalNumber: key + 1,
        score: item.count,
        text: `${item.name}, ${item.city}`,
        token: key + 1,
      }));

      datasources.listTemplate1Metadata.headerTitle = voxaEvent.t('Competition.ResultsTitle');
      datasources.listTemplate1ListData.listPage.listItems = listItems;
      datasources.listTemplate1ListData.totalNumberOfItems = _.size(listItems);

      reply.alexaAPLTemplate = {
        token: 'APL',
        type: 'Alexa.Presentation.APL.RenderDocument',
        document: documentTemplate,
        datasources,
      };
    } else if (hasScreenInterface) {
      const listTemplate1 = new DisplayTemplate('ListTemplate1')
        .setTitle(voxaEvent.t('Competition.ResultsTitle'))
        .setToken('listTemplate1')
        .setBackButton('HIDDEN');

      _.forEach(playerArray, (item, key) => {
        listTemplate1.addItem(
          key + 1,
          null,
          `<font size='5'>${item.name}, ${item.city}</font>`,
          `<font size='3'>${voxaEvent.t('Competition.ResultsItemScreen', item)}</font>`,
        );
      });

      reply.alexaRenderTemplate = listTemplate1;
    }

    const cardContentArray = _.map(playerArray, (item, key) => {
      const params = {
        order: key + 1,
        ...item,
      };

      return voxaEvent.t('Competition.ResultsItem', params);
    });

    const alexaCardContent = _.join(cardContentArray, '\n');

    reply.alexaCard = {
      content: alexaCardContent,
      title: voxaEvent.t('Competition.ResultsTitle'),
      type: 'Simple',
    };

    return reply;
  }

  static deserialize(data) {
    return new this(data);
  }

  serialize() {
    return this;
  }
}

module.exports = Model;
