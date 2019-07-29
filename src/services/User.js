'use strict';

const { DynamoDB } = require('aws-sdk');
const _ = require('lodash');
const config = require('../config');

class User {
  static async get(voxaEvent) {
    const key = { userId: voxaEvent.user.userId };
    const client = new DynamoDB.DocumentClient();

    const item = await client
      .get({ Key: key, TableName: config.dynamoDB.tables.users })
      .promise();

    return new User(item.Item);
  }

  constructor(data) {
    const defaults = {
      reminderCount: 0,
      sessionCount: 0,
    };

    this.client = new DynamoDB.DocumentClient();
    this.data = { ...defaults, ...data };
  }

  newSession() {
    this.data.sessionCount += 1;
    this.data.reminderCount += 1;
  }

  get isFirstTime() {
    return this.data.sessionCount === 1;
  }

  get sessionCount() {
    return this.data.sessionCount;
  }

  async getAllUsersInChallenge(previousItems, lastEvaluatedKey) {
    previousItems = previousItems || [];

    const params = {
      ExpressionAttributeNames: {
        '#competitions': 'competitions',
      },
      FilterExpression: 'attribute_exists(#competitions)',
      TableName: config.dynamoDB.tables.users,
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await this.client.scan(params).promise();
    const items = _.concat(previousItems, result.Items || []);

    if (_.isEmpty(result.LastEvaluatedKey)) {
      return items;
    }

    return this.getAllUsersInChallenge(items, result.LastEvaluatedKey);
  }

  addPoints(competitionId, points) {
    const competitions = this.data.competitions || [];
    const currentCompetition = _.find(competitions, { competitionId });

    if (currentCompetition) {
      currentCompetition.score += points;
    } else {
      this.data.competitions = [
        {
          competitionId,
          score: points,
        },
      ];
    }
  }

  cancelSubscription() {
    this.data.isCanceled = true;
  }

  getCurrentPoints(competitionId) {
    const competitions = this.data.competitions || [];
    const currentCompetition = _.find(competitions, { competitionId }) || {};

    return currentCompetition.score;
  }

  async getUserPosition(competitionId, allUsers) {
    if (!competitionId) {
      competitionId = this.getCompetitiondId(context);
    }

    const { competitions } = this.data;
    const currentCompetition = _.find(competitions, { competitionId });

    const playersArray = _(allUsers)
      .map(x => _.find(x.competitions, { competitionId }))
      .compact()
      .orderBy(['score'], ['desc'])
      .map('score')
      .value();

    const position = _.indexOf(playersArray, currentCompetition.score) + 1;
    return [position, currentCompetition.score, _.size(playersArray)];
  }

  hasPoints(competitionId) {
    const currentPoints = this.getCurrentPoints(competitionId);

    return currentPoints > 0;
  }

  isUserInCompetition(competitionId) {
    const { competitions, isCanceled } = this.data;
    const currentCompetition = _.find(competitions, { competitionId });

    return !_.isUndefined(currentCompetition) && !isCanceled;
  }

  removePoints(competitionId) {
    const competitions = this.data.competitions || [];
    const currentCompetition = _.find(competitions, { competitionId }) || {};

    // IF USER FAILS, WE REMOVE 1 POINT FROM THEIR SCORE
    if (currentCompetition.score > 0) {
      currentCompetition.score -= 1;
    }
  }

  saveUserAddress(info) {
    this.data = _.merge(this.data, info);
  }

  saveUserInfo(info) {
    this.data.email = info.email;
    this.data.name = info.name;
    this.data.zipCode = info.zipCode;
  }

  toJSON() {
    return this.data;
  }

  save(key) {
    const data = _.toPlainObject({ ...this.data, ...key });

    if (!data.createdDate) {
      data.createdDate = new Date().toISOString();
    }

    data.modifiedDate = new Date().toISOString();
    return this.client
      .put({
        Item: data,
        TableName: config.dynamoDB.tables.users,
      })
      .promise();
  }
}

module.exports = User;
