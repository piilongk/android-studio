import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ExecutorService, WorkflowGraph } from './workflow/executor.service';
import { DeviceGateway } from './device/device.gateway';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly executorService: ExecutorService,
    private readonly deviceGateway: DeviceGateway,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('devices')
  getDevices() {
    return this.deviceGateway.getOnlineDevices();
  }

  @Post('workflow/start')
  async startWorkflow(@Body() body: { deviceId: string; graph: WorkflowGraph }) {
    await this.executorService.startWorkflow(body.deviceId, body.graph);
    return { status: 'success', message: 'Workflow started' };
  }

  @Post('workflow/pause')
  async pauseWorkflow(@Body() body: { deviceId: string }) {
    await this.executorService.pauseWorkflow(body.deviceId);
    return { status: 'success', message: 'Workflow paused' };
  }

  @Post('workflow/resume')
  async resumeWorkflow(@Body() body: { deviceId: string }) {
    await this.executorService.resumeWorkflow(body.deviceId);
    return { status: 'success', message: 'Workflow resumed' };
  }

  @Post('workflow/stop')
  async stopWorkflow(@Body() body: { deviceId: string }) {
    await this.executorService.stopWorkflow(body.deviceId);
    return { status: 'success', message: 'Workflow stopped' };
  }

  @Post('workflow/breakpoint')
  toggleBreakpoint(@Body() body: { deviceId: string; nodeId: string; active: boolean }) {
    this.executorService.toggleBreakpoint(body.deviceId, body.nodeId, body.active);
    return { status: 'success' };
  }
}
