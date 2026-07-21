import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'device',
})
export class DeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('DeviceGateway');

  // Maps deviceId -> Agent Socket
  private agents = new Map<string, Socket>();
  // Maps deviceId -> Set of Web Studio sockets monitoring it
  private monitors = new Map<string, Set<Socket>>();
  // Active executing requests maps: messageId -> Callback resolver
  private pendingCommands = new Map<string, (result: any) => void>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up if it was an agent
    for (const [deviceId, socket] of this.agents.entries()) {
      if (socket.id === client.id) {
        this.agents.delete(deviceId);
        this.logger.log(`Agent offline: ${deviceId}`);
        this.broadcastToMonitors(deviceId, 'deviceOffline', { deviceId });
        break;
      }
    }

    // Clean up if it was a monitor
    for (const [deviceId, monitorSet] of this.monitors.entries()) {
      if (monitorSet.has(client)) {
        monitorSet.delete(client);
        this.logger.log(`Web monitor left device: ${deviceId}`);
      }
    }
  }

  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string; osVersion: string },
  ) {
    const { deviceId } = data;
    this.agents.set(deviceId, client);
    this.logger.log(`Agent registered: ${deviceId} (OS: ${data.osVersion})`);
    
    client.emit('registered', { status: 'success' });
    this.server.emit('deviceOnline', { deviceId, status: 'online' });
  }

  @SubscribeMessage('subscribeDevice')
  handleSubscribeDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    const { deviceId } = data;
    if (!this.monitors.has(deviceId)) {
      this.monitors.set(deviceId, new Set());
    }
    this.monitors.get(deviceId)!.add(client);
    this.logger.log(`Web client ${client.id} subscribed to device: ${deviceId}`);

    // If agent is online, notify the subscriber
    const isOnline = this.agents.has(deviceId);
    client.emit('deviceStatus', { deviceId, status: isOnline ? 'online' : 'offline' });
  }

  @SubscribeMessage('commandResult')
  handleCommandResult(@MessageBody() data: { messageId: string; status: string; error?: string; message?: string; tree?: any }) {
    const { messageId } = data;
    const resolver = this.pendingCommands.get(messageId);
    if (resolver) {
      resolver(data);
      this.pendingCommands.delete(messageId);
    }
  }

  @SubscribeMessage('videoFrame')
  handleVideoFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string; frame: string },
  ) {
    const { deviceId, frame } = data;
    const monitors = this.monitors.get(deviceId);
    if (monitors) {
      for (const monitor of monitors) {
        monitor.emit('videoFrame', frame);
      }
    }
  }

  @SubscribeMessage('screenUpdate')
  handleScreenUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tree: any },
  ) {
    // Find device ID for this socket
    let deviceId = '';
    for (const [id, socket] of this.agents.entries()) {
      if (socket.id === client.id) {
        deviceId = id;
        break;
      }
    }

    if (deviceId) {
      this.broadcastToMonitors(deviceId, 'screenUpdate', { deviceId, tree: data.tree });
    }
  }

  // Sends command to Android Agent and waits for reply asynchronously
  async sendCommandToDevice(deviceId: string, action: string, payload: any): Promise<any> {
    const agentSocket = this.agents.get(deviceId);
    if (!agentSocket) {
      throw new Error(`Device ${deviceId} is offline`);
    }

    const messageId = Math.random().toString(36).substring(2, 9);
    
    return new Promise((resolve, reject) => {
      // Set timeout for the execution (e.g. 15 seconds)
      const timeout = setTimeout(() => {
        if (this.pendingCommands.has(messageId)) {
          this.pendingCommands.delete(messageId);
          reject(new Error(`Command ${action} timed out on device`));
        }
      }, 15000);

      this.pendingCommands.set(messageId, (result) => {
        clearTimeout(timeout);
        if (result.status === 'error') {
          reject(new Error(result.error || 'Execution failed'));
        } else {
          resolve(result);
        }
      });

      agentSocket.emit('message', JSON.stringify({
        messageId,
        action,
        payload,
      }));
    });
  }

  // Broadcasts screen video frames (H.264 chunks) to web monitors
  broadcastVideoFrame(deviceId: string, chunk: Buffer) {
    const monitorSet = this.monitors.get(deviceId);
    if (monitorSet && monitorSet.size > 0) {
      for (const socket of monitorSet) {
        socket.emit('videoFrame', chunk);
      }
    }
  }

  private broadcastToMonitors(deviceId: string, event: string, payload: any) {
    const monitorSet = this.monitors.get(deviceId);
    if (monitorSet) {
      for (const socket of monitorSet) {
        socket.emit(event, payload);
      }
    }
  }

  // Returns list of active online devices
  getOnlineDevices(): string[] {
    return Array.from(this.agents.keys());
  }
}
