import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log('event', JSON.stringify(event));
    console.log('context', JSON.stringify(context));

    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    const ConnectionId = event.requestContext.connectionId!;
    const callbackUrl = `https://${domain}/${stage}`;
    const clientApi = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

    const message = JSON.parse(event.body || '{}');

    switch (message.type) {
        case 'subscribe':
            for (const topicName of (message.topics ?? [])) {
                if (typeof topicName === 'string') {
                    // Subscribe to the topic
                    await ddbDocClient.send(new PutCommand({
                        TableName: process.env.TABLE_NAME!,
                        Item: {
                            PK: `TOPIC#${topicName}`,
                            SK: `SUBSCRIBER#${ConnectionId}`
                        }
                    }));
                }
            }
            break;

        case 'unsubscribe':
            for (const topicName of (message.topics ?? [])) {
                if (typeof topicName === 'string') {
                    // Unsubscribe from the topic
                    await ddbDocClient.send(new DeleteCommand({
                        TableName: process.env.TABLE_NAME!,
                        Key: {
                            PK: `TOPIC#${topicName}`,
                            SK: `SUBSCRIBER#${ConnectionId}`
                        }
                    }));
                }
            }
            break;

        case 'publish':
            if (message.topic) {
                // Fetch all subscribers for the topic
                const result = await ddbDocClient.send(new QueryCommand({
                    TableName: process.env.TABLE_NAME!,
                    KeyConditionExpression: "PK = :pk",
                    ExpressionAttributeValues: {
                        ":pk": `TOPIC#${message.topic}`
                    }
                }));

                const receivers = result.Items?.map(item => item.SK.replace('SUBSCRIBER#', '')) ?? [];

                console.log('receivers', receivers);

                if (receivers.length) {
                    message.clients = receivers.length;
                    for (const receiver of receivers) {
                        const data = JSON.stringify(message);
                        const requestParams = {
                            ConnectionId: receiver,
                            Data: data,
                        };
                        console.log('requestParams', requestParams);
                        const command = new PostToConnectionCommand(requestParams);
                        try {
                            await clientApi.send(command);
                        } catch (error: any) {
                            if (error.name === 'GoneException') {
                                console.log(`Connection ${receiver} is gone. Removing from subscribers.`);
                                await ddbDocClient.send(new DeleteCommand({
                                    TableName: process.env.TABLE_NAME!,
                                    Key: {
                                        PK: `TOPIC#${message.topic}`,
                                        SK: `SUBSCRIBER#${receiver}`
                                    }
                                }));
                            }
                        }
                    }
                }
            }   
            break;

        case 'ping':
            await clientApi.send(new PostToConnectionCommand({
                ConnectionId,
                Data: JSON.stringify({ type: 'pong' })
            }));
            break;
            
        default:
            await clientApi.send(new PostToConnectionCommand({
                ConnectionId,
                Data: JSON.stringify({ error: 'No handler for this message type' })
            }));
    }

    return {
        statusCode: 200,
        body: 'Success'
    };
};
