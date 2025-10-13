import { WebSocketManager } from '../lib/websocketManager';

declare global {
  var websocketManager: WebSocketManager | undefined;
}

export {};
