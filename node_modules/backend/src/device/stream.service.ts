import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as net from 'net';
import { DeviceGateway } from './device.gateway';

@Injectable()
export class StreamService implements OnModuleInit, OnModuleDestroy {
  private server: net.Server;
  private readonly logger = new Logger('StreamService');
  private readonly port = 3001;

  constructor(private readonly deviceGateway: DeviceGateway) {}

  onModuleInit() {
    this.server = net.createServer((socket) => {
      this.logger.log(`New TCP stream connection from ${socket.remoteAddress}`);
      let deviceId = '';
      let buffer = '';

      socket.on('data', (chunk) => {
        if (!deviceId) {
          // Parse the header JSON metadata line first
          buffer += chunk.toString('utf8');
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd !== -1) {
            const headerLine = buffer.substring(0, lineEnd);
            try {
              const header = JSON.parse(headerLine);
              deviceId = header.deviceId;
              this.logger.log(`Device stream registered: ${deviceId} (${header.width}x${header.height})`);
              
              // Process remaining chunk data as raw video stream
              const remaining = buffer.substring(lineEnd + 1);
              if (remaining.length > 0) {
                this.deviceGateway.broadcastVideoFrame(deviceId, Buffer.from(remaining, 'utf8'));
              }
            } catch (err) {
              this.logger.error(`Failed to parse stream header: ${err.message}`);
              socket.destroy();
            }
            buffer = '';
          }
        } else {
          // Relay raw H.264 video chunks to frontend subscribers
          this.deviceGateway.broadcastVideoFrame(deviceId, chunk);
        }
      });

      socket.on('error', (err) => {
        this.logger.error(`Socket error for ${deviceId || 'unknown'}: ${err.message}`);
      });

      socket.on('close', () => {
        this.logger.log(`Stream connection closed for: ${deviceId || 'unknown'}`);
      });
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      this.logger.log(`TCP Video Streaming Server listening on port ${this.port}`);
    });
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
      this.logger.log('TCP Streaming server shut down.');
    }
  }
}
