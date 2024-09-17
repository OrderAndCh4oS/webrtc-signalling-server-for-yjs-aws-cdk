# WebRTC Signalling Server WebSocket for YJS CDK

## Example Test Client

```js
import WebSocket from 'ws';

const YOUR_WEBSOCKET_URL = 'wss://{ID}.execute-api.{REGION}.amazonaws.com/{STAGE}'

let socket = new WebSocket(YOUR_WEBSOCKET_URL);

socket.onopen = function(e) {
    console.log("[open] Connection established");
    console.log("Sending to server");
    // Ping the server
    socket.send(JSON.stringify({ type: "ping" }));
    // Subscribe to a topic
    socket.send(JSON.stringify({ type: "subscribe", topics: ["topic_one"] }));
    // Publish a message to a topic
    socket.send(JSON.stringify({ type: "publish", topic: "topic_one", data: "Hello, subscribers!" }));
    // Unsubscribe from a topic
    socket.send(JSON.stringify({ type: "unsubscribe", topics: ["topic_one"] }));
};

socket.onmessage = function(event) {
    console.log(`[message] Data received from server: ${event.data}`);
};

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.log('[close] Connection died');
    }
};

socket.onerror = function(error) {
    console.log(`[error] ${error.message}`);
};
```