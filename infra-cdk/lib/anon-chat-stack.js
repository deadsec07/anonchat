const path = require('path');
const cdk = require('aws-cdk-lib');
const { Stack, CfnOutput, Tags, Duration } = cdk;
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigwv2 = require('aws-cdk-lib/aws-apigatewayv2');
const logs = require('aws-cdk-lib/aws-logs');
const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const route53 = require('aws-cdk-lib/aws-route53');
const targets = require('aws-cdk-lib/aws-route53-targets');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const iam = require('aws-cdk-lib/aws-iam');

class AnonChatStack extends Stack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    const appName = (props.appName || 'anonchat').toString();
    const namePrefix = sanitize(appName);
    const fullPrefix = namePrefix;

    // Tags for easy identification in accounts with other infra
    Tags.of(this).add('Project', 'anonchat');

    // DynamoDB table for connections
    const table = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: `${fullPrefix}-Connections`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // dev default; change to RETAIN for prod if desired
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI_Room',
      partitionKey: { name: 'roomId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda code asset path (re-use existing handlers)
    const codePath = path.join(__dirname, '../../backend/src');

    const makeFn = (id, file, extraEnv = {}) => {
      const fn = new lambda.Function(this, id, {
        functionName: `${fullPrefix}-${id}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${file}.handler`,
        code: lambda.Code.fromAsset(codePath),
        memorySize: 128,
        timeout: Duration.seconds(10),
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          TABLE_NAME: table.tableName,
          VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
          VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
          VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
          ...extraEnv,
        },
      });
      table.grantReadWriteData(fn);
      return fn;
    };

    const connectFn = makeFn('connect', 'handlers/connect');
    const disconnectFn = makeFn('disconnect', 'handlers/disconnect');
    const joinFn = makeFn('join', 'handlers/join');
    const sendFn = makeFn('send', 'handlers/send');
    const dmFn = makeFn('dm', 'handlers/dm');
    const roomsFn = makeFn('rooms', 'handlers/rooms');
    const whoFn = makeFn('who', 'handlers/who');
    const typingFn = makeFn('typing', 'handlers/typing');
    const pushSubFn = makeFn('push_subscribe', 'handlers/push_subscribe');
    // Attachments: S3 bucket (temporary) + presign Lambda
    const attachBucket = new s3.Bucket(this, 'AttachmentsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    attachBucket.addCorsRule({
      allowedOrigins: ['*'],
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag'],
      maxAge: 3000,
    });

    const presignFn = new lambda.Function(this, 'presign', {
      functionName: `${fullPrefix}-presign`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/presign.handler',
      code: lambda.Code.fromAsset(codePath),
      memorySize: 128,
      timeout: Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        TABLE_NAME: table.tableName,
        ATTACH_BUCKET: attachBucket.bucketName,
        VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
        VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      },
    });
    table.grantReadData(presignFn);
    attachBucket.grantReadWrite(presignFn);

    // WebSocket API (low-level Cfn resources to avoid alpha modules)
    const api = new apigwv2.CfnApi(this, 'WsApi', {
      name: `${fullPrefix}-WsApi`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const stage = new apigwv2.CfnStage(this, 'WsStage', {
      apiId: api.ref,
      stageName: '$default',
      autoDeploy: true,
    });

    const integrationUri = (fn) => `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`;

    const connectInt = new apigwv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(connectFn),
      integrationMethod: 'POST',
    });

    const disconnectInt = new apigwv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(disconnectFn),
      integrationMethod: 'POST',
    });

    const joinInt = new apigwv2.CfnIntegration(this, 'JoinIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(joinFn),
      integrationMethod: 'POST',
    });

    const sendInt = new apigwv2.CfnIntegration(this, 'SendIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(sendFn),
      integrationMethod: 'POST',
    });

    const dmInt = new apigwv2.CfnIntegration(this, 'DmIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(dmFn),
      integrationMethod: 'POST',
    });

    const whoInt = new apigwv2.CfnIntegration(this, 'WhoIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(whoFn),
      integrationMethod: 'POST',
    });

    const typingInt = new apigwv2.CfnIntegration(this, 'TypingIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(typingFn),
      integrationMethod: 'POST',
    });

    const roomsInt = new apigwv2.CfnIntegration(this, 'RoomsIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(roomsFn),
      integrationMethod: 'POST',
    });
    const presignInt = new apigwv2.CfnIntegration(this, 'PresignIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(presignFn),
      integrationMethod: 'POST',
    });
    const pushSubInt = new apigwv2.CfnIntegration(this, 'PushSubIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(pushSubFn),
      integrationMethod: 'POST',
    });
    const setCodeFn = makeFn('set_code', 'handlers/set_code');
    const setCodeInt = new apigwv2.CfnIntegration(this, 'SetCodeIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: integrationUri(setCodeFn),
      integrationMethod: 'POST',
    });

    const connectRoute = new apigwv2.CfnRoute(this, 'RouteConnect', {
      apiId: api.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectInt.ref}`,
    });
    const disconnectRoute = new apigwv2.CfnRoute(this, 'RouteDisconnect', {
      apiId: api.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      target: `integrations/${disconnectInt.ref}`,
    });
    const joinRoute = new apigwv2.CfnRoute(this, 'RouteJoin', {
      apiId: api.ref,
      routeKey: 'join',
      authorizationType: 'NONE',
      target: `integrations/${joinInt.ref}`,
    });
    const sendRoute = new apigwv2.CfnRoute(this, 'RouteSend', {
      apiId: api.ref,
      routeKey: 'send',
      authorizationType: 'NONE',
      target: `integrations/${sendInt.ref}`,
    });

    const dmRoute = new apigwv2.CfnRoute(this, 'RouteDm', {
      apiId: api.ref,
      routeKey: 'dm',
      authorizationType: 'NONE',
      target: `integrations/${dmInt.ref}`,
    });

    const whoRoute = new apigwv2.CfnRoute(this, 'RouteWho', {
      apiId: api.ref,
      routeKey: 'who',
      authorizationType: 'NONE',
      target: `integrations/${whoInt.ref}`,
    });

    const typingRoute = new apigwv2.CfnRoute(this, 'RouteTyping', {
      apiId: api.ref,
      routeKey: 'typing',
      authorizationType: 'NONE',
      target: `integrations/${typingInt.ref}`,
    });
    const pushSubRoute = new apigwv2.CfnRoute(this, 'RoutePushSub', {
      apiId: api.ref,
      routeKey: 'push_subscribe',
      authorizationType: 'NONE',
      target: `integrations/${pushSubInt.ref}`,
    });

    const roomsRoute = new apigwv2.CfnRoute(this, 'RouteRooms', {
      apiId: api.ref,
      routeKey: 'rooms',
      authorizationType: 'NONE',
      target: `integrations/${roomsInt.ref}`,
    });
    const presignRoute = new apigwv2.CfnRoute(this, 'RoutePresign', {
      apiId: api.ref,
      routeKey: 'presign',
      authorizationType: 'NONE',
      target: `integrations/${presignInt.ref}`,
    });
    const setCodeRoute = new apigwv2.CfnRoute(this, 'RouteSetCode', {
      apiId: api.ref,
      routeKey: 'set_code',
      authorizationType: 'NONE',
      target: `integrations/${setCodeInt.ref}`,
    });

    // Allow API Gateway to invoke Lambdas
    const sourceArn = `arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/*`;
    [
      { id: 'PermConnect', fn: connectFn },
      { id: 'PermDisconnect', fn: disconnectFn },
      { id: 'PermJoin', fn: joinFn },
      { id: 'PermSend', fn: sendFn },
      { id: 'PermDm', fn: dmFn },
      { id: 'PermRooms', fn: roomsFn },
      { id: 'PermWho', fn: whoFn },
      { id: 'PermTyping', fn: typingFn },
      { id: 'PermPresign', fn: presignFn },
      { id: 'PermPushSub', fn: pushSubFn },
    ].forEach(({ id, fn }) => {
      new lambda.CfnPermission(this, id, {
        action: 'lambda:InvokeFunction',
        functionName: fn.functionName,
        principal: 'apigateway.amazonaws.com',
        sourceArn,
      });
    });

    // Grant Lambdas permission to post to connections (execute-api:ManageConnections)
    const manageConnectionsActions = ['execute-api:ManageConnections'];
    // Restrict to posting to WebSocket connections for any stage
    const manageConnectionsResource = `arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/*/POST/@connections/*`;
    [
      connectFn,
      disconnectFn,
      joinFn,
      sendFn,
      dmFn,
      roomsFn,
      whoFn,
      typingFn,
      presignFn,
      setCodeFn,
      pushSubFn,
    ].forEach((fn) => {
      fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: manageConnectionsActions,
        resources: [manageConnectionsResource],
      }));
    });

    // Ensure deployment order
    [connectInt, disconnectInt, joinInt, sendInt, dmInt, roomsInt, whoInt, typingInt, presignInt, pushSubInt, setCodeInt].forEach((intg) => intg.addDependency(stage));
    [connectRoute, disconnectRoute, joinRoute, sendRoute, dmRoute, roomsRoute, whoRoute, typingRoute, presignRoute, pushSubRoute, setCodeRoute].forEach((r) => r.addDependency(stage));

    new CfnOutput(this, 'WebSocketUrl', {
      value: `wss://${api.ref}.execute-api.${this.region}.amazonaws.com/$default`,
    });

    // Static site S3 bucket (private) + CloudFront
    const { Bucket, BucketEncryption, BlockPublicAccess } = s3;
    const siteBucket = new Bucket(this, 'WebsiteBucket', {
      bucketName: undefined, // let CDK name it to avoid collisions
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });
    // Optional: Custom domain via Route53 + ACM (us-east-1 required for CloudFront)
    const zone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: 'hnetechnologies.com' });
    const cert = new acm.DnsValidatedCertificate(this, 'WebsiteCert', {
      domainName: 'anonchat.hnetechnologies.com',
      hostedZone: zone,
      region: 'us-east-1',
    });

    // CloudFront with OAI and Price Class 200
    const oai = new cloudfront.OriginAccessIdentity(this, 'WebsiteOAI');
    siteBucket.grantRead(oai);
    const s3Origin = new origins.S3Origin(siteBucket, { originAccessIdentity: oai });
    const dist = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      domainNames: ['anonchat.hnetechnologies.com'],
      certificate: cert,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        '/index.html': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          compress: true,
        },
      },
    });
    new CfnOutput(this, 'WebsiteBucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'WebsiteUrl', { value: `https://${dist.domainName}` });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: dist.distributionId });
    new CfnOutput(this, 'WebsiteCustomDomain', { value: 'https://anonchat.hnetechnologies.com' });
    new CfnOutput(this, 'CertificateArn', { value: cert.certificateArn });

    // Route53 A/AAAA Alias to CloudFront
    new route53.ARecord(this, 'WebsiteAliasARecord', {
      zone,
      recordName: 'anonchat',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(dist)),
      ttl: cdk.Duration.minutes(5),
    });
    new route53.AaaaRecord(this, 'WebsiteAliasAAAARecord', {
      zone,
      recordName: 'anonchat',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(dist)),
      ttl: cdk.Duration.minutes(5),
    });
  }
}

function sanitize(s) {
  return (s || '').toString().replace(/[^a-zA-Z0-9-]/g, '-');
}

module.exports = { AnonChatStack };
