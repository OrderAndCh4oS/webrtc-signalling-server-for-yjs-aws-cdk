import {APIGatewayProxyEvent, APIGatewayProxyResultV2, Context} from "aws-lambda";

import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, PutCommand} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({region: process.env.AWS_REGION});
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResultV2> => {
    console.log('event', JSON.stringify(event));
    console.log('context', JSON.stringify(context));

    try {
        await ddbDocClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME!,
            Item: {
                PK: `CONNECTION#${event.requestContext.connectionId}`,
                SK: 'METADATA',
                ttl: Math.floor((Date.now() / 1000) + (60 * 60 * 3)) // 3 hour ttl
            }
        }));
    } catch (err) {
        console.log(err);
        throw err;
    }

    return {
        statusCode: 200
    };
};
