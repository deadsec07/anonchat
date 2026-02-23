#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { AnonChatStack } = require('../lib/anon-chat-stack');

const app = new cdk.App();

function sanitize(s) { return (s || '').toString().replace(/[^a-zA-Z0-9-]/g, '-'); }

const appName = app.node.tryGetContext('appName') || process.env.APP_NAME || 'anonchat';
const stackId = sanitize(appName);

new AnonChatStack(app, stackId, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  appName,
});
