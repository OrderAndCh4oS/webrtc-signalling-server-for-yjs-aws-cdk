import * as cdk from 'aws-cdk-lib';
import {Aws, CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";
import {WebsocketApi} from "./websocket-api";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {NodejsFunction, NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";
import {Environment} from "../bin/environment";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {Rule, Schedule} from 'aws-cdk-lib/aws-events';
import {LambdaFunction as TargetLambda} from 'aws-cdk-lib/aws-events-targets';

export class AwsCdkV2WebsocketStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: cdk.StackProps, envs: Environment) {
        super(scope, id, props);
        this.addWebsocket(envs);
    }

    private addWebsocket(envs: Environment) {
        const connectionsTable = new Table(this, 'ConnectionsTable', {
            partitionKey: { name: 'PK', type: AttributeType.STRING },
            sortKey: { name: 'SK', type: AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl"
        });

        const commonHandlerProps: NodejsFunctionProps = {
            bundling: {minify: true, sourceMap: true, target: 'es2019'},
            runtime: Runtime.NODEJS_20_X,
            logRetention: RetentionDays.THREE_DAYS
        };

        // const authorizationHandler = new NodejsFunction(this, 'AuthorisationHandlerWebsocketDemo', {
        //     ...commonHandlerProps,
        //     entry: 'lambda/handlers/authorisation.ts',
        //     environment: {
        //         // Todo: use env
        //         ISSUER: 'https://app-auth.eu.auth0.com/',
        //         AUDIENCE: 'https://app-demo.com',
        //     }
        // });


        const connectHandler = new NodejsFunction(this, 'ConnectHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/connect.ts',
            environment: {
                TABLE_NAME: connectionsTable.tableName // Ensure this is set correctly
            }
        });
        
        const defaultHandler = new NodejsFunction(this, 'DefaultHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/default.ts',
            environment: {
                TABLE_NAME: connectionsTable.tableName // Ensure this is set correctly
            }
        });

        const disconnectHandler = new NodejsFunction(this, 'DisconnectHandlerWebsocketDemo', {
            ...commonHandlerProps,
            entry: 'lambda/websocket/disconnect.ts',
            environment: {
                TABLE_NAME: connectionsTable.tableName // Ensure this is set correctly
            }
        });

        connectionsTable.grantReadWriteData(connectHandler);
        connectionsTable.grantReadWriteData(disconnectHandler);
        connectionsTable.grantReadWriteData(defaultHandler);

        const websocketApi = new WebsocketApi(
            this,
            "MessageWebsocketApiWebsocketDemo",
            {
                apiName: "web-rtc-signalling-server-websocket",
                apiDescription: "Websocket for Yjs WebRTC Signalling Server",
                stageName: envs.STAGE,
                connectHandler,
                disconnectHandler,
                defaultHandler,
                connectionsTable,
                // authorizationHandler
            },
            // envs
        );

        const CONNECTION_URL = `https://${websocketApi.api.ref}.execute-api.${Aws.REGION}.amazonaws.com/${envs.STAGE}`;

        websocketApi.addLambdaIntegration(defaultHandler, 'message', 'WebRtcSignallingServerRoute');

        const managementApiPolicyStatement = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApi.api.ref}/*`]
        });
        defaultHandler.addToRolePolicy(managementApiPolicyStatement);


        new CfnOutput(this, 'WebsocketConnectionUrl', {value: CONNECTION_URL});

        const websocketApiUrl = `${websocketApi.api.attrApiEndpoint}/${envs.STAGE}`;
        new CfnOutput(this, "WebsocketUrl", {
            value: websocketApiUrl
        });
    }
}
