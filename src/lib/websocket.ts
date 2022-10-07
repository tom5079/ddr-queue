import type { IMQueueInfo, InboundMessage, OutboundMessage } from './messages.js'

const subscriptions = {
    all: new Set<(msg: string) => void>(),
    queueInfo: new Set<(msg: IMQueueInfo) => void>()
}

// TODO handle disconnect->reconnect logic with exponential timeout
function createWebsocket(url: string) {
    let socket: WebSocket | undefined, openPromise: Promise<void> | undefined;
    const messageHandlers: { [key: string]: (msg: InboundMessage) => void } = {
        queueInfo: msg => subscriptions.queueInfo.forEach(subscription => subscription(msg as IMQueueInfo))
    }

    function open() {
        if (openPromise || socket?.OPEN) return openPromise;

        socket = new WebSocket(url);

        socket.onmessage = event => {
            const msg = JSON.parse(event.data);
            subscriptions.all.forEach(s => s(msg));
            messageHandlers[msg.action]?.(msg);
        }

        openPromise = new Promise((resolve, reject) => {
            socket!!.onerror = error => {
                reject(error);
                openPromise = undefined;
            };

            socket!!.onopen = event => {
                resolve();
                openPromise = undefined;
            }
        });

        return openPromise;
    }

    function close() {
        if (socket) socket.close();
        socket = undefined;
    }

    return {
        async send(message: OutboundMessage) {
            await open();
            if (socket) message.sendTo(socket);
        },
        subscribe(handler: (msg: string) => void) {
            subscriptions.all.add(handler);
            return () => {
                subscriptions.all.delete(handler);
            }
        },
        onQueueInfo(handler: (msg: IMQueueInfo) => void) {
            subscriptions.queueInfo.add(handler);
            return () => {
                subscriptions.queueInfo.delete(handler);
            }
        }
    }
}

export const socket = createWebsocket("wss://75dz4fc17b.execute-api.us-west-1.amazonaws.com/production");