#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { AnonChatStack } = require('../lib/anon-chat-stack');

const app = new cdk.App();

new AnonChatStack(app, 'anonchat', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  appName: 'anonchat',
});
