import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeviceGateway } from './device/device.gateway';
import { StreamService } from './device/stream.service';
import { ExecutorService } from './workflow/executor.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    DeviceGateway,
    StreamService,
    ExecutorService,
  ],
})
export class AppModule {}
