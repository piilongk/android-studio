import { Injectable, Logger } from '@nestjs/common';
import { DeviceGateway } from '../device/device.gateway';

export interface WorkflowNode {
  id: string;
  type: string;
  data: any;
  inputs?: any[];
  outputs?: any[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionContext {
  variables: Record<string, any>;
  breakpoints: Set<string>;
  paused: boolean;
  pausedNodeId?: string;
  pauseResolver?: () => void;
  isRunning: boolean;
}

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger('ExecutorService');
  
  // Maps deviceId -> ExecutionContext
  private activeExecutions = new Map<string, ExecutionContext>();

  constructor(private readonly deviceGateway: DeviceGateway) {}

  async startWorkflow(deviceId: string, graph: WorkflowGraph) {
    if (this.activeExecutions.has(deviceId)) {
      throw new Error(`Device ${deviceId} has an active execution`);
    }

    const context: ExecutionContext = {
      variables: {
        global: {},
        local: {},
        device: {
          id: deviceId,
          timestamp: Date.now(),
        },
      },
      breakpoints: new Set(),
      paused: false,
      isRunning: true,
    };

    this.activeExecutions.set(deviceId, context);
    this.logger.log(`Starting workflow execution for device: ${deviceId}`);

    // Run execution in background/async thread context
    this.runEngine(deviceId, graph, context).catch((err) => {
      this.logger.error(`Execution error for device ${deviceId}: ${err.message}`);
      this.notifyMonitor(deviceId, 'executionFailed', { error: err.message });
      this.activeExecutions.delete(deviceId);
    });
  }

  async pauseWorkflow(deviceId: string) {
    const context = this.activeExecutions.get(deviceId);
    if (context && context.isRunning) {
      context.paused = true;
      this.logger.log(`Pausing workflow execution for device: ${deviceId}`);
    }
  }

  async resumeWorkflow(deviceId: string) {
    const context = this.activeExecutions.get(deviceId);
    if (context && context.paused && context.pauseResolver) {
      context.paused = false;
      const resolve = context.pauseResolver;
      context.pauseResolver = undefined;
      context.pausedNodeId = undefined;
      this.logger.log(`Resuming workflow execution for device: ${deviceId}`);
      resolve(); // Resume execution
    }
  }

  async stopWorkflow(deviceId: string) {
    const context = this.activeExecutions.get(deviceId);
    if (context) {
      context.isRunning = false;
      if (context.pauseResolver) {
        context.pauseResolver();
      }
      this.activeExecutions.delete(deviceId);
      this.logger.log(`Stopped workflow execution for device: ${deviceId}`);
      this.notifyMonitor(deviceId, 'executionStopped', {});
    }
  }

  toggleBreakpoint(deviceId: string, nodeId: string, active: boolean) {
    const context = this.activeExecutions.get(deviceId);
    if (context) {
      if (active) {
        context.breakpoints.add(nodeId);
      } else {
        context.breakpoints.delete(nodeId);
      }
    }
  }

  getWatchVariables(deviceId: string) {
    const context = this.activeExecutions.get(deviceId);
    return context ? context.variables : null;
  }

  private async runEngine(deviceId: string, graph: WorkflowGraph, context: ExecutionContext) {
    const nodesMap = new Map<string, WorkflowNode>();
    graph.nodes.forEach((n) => nodesMap.set(n.id, n));

    // Find Start node
    const startNode = graph.nodes.find((n) => n.type === 'start');
    if (!startNode) {
      throw new Error('Start node not found in workflow');
    }

    let currentNode: WorkflowNode | undefined = startNode;
    
    while (currentNode && context.isRunning) {
      const nodeId = currentNode.id;
      
      // Notify monitors which node is running
      this.notifyMonitor(deviceId, 'nodeStatus', { nodeId, status: 'running' });

      // Check for debugger breakpoint or manual pause
      if (context.breakpoints.has(nodeId) || context.paused) {
        context.paused = true;
        context.pausedNodeId = nodeId;
        this.notifyMonitor(deviceId, 'nodeStatus', { nodeId, status: 'paused', variables: context.variables });
        
        // Wait until resume signal is triggered
        await new Promise<void>((resolve) => {
          context.pauseResolver = resolve;
        });

        if (!context.isRunning) break;
      }

      try {
        // Execute the node
        const result = await this.executeNode(deviceId, currentNode, context);
        
        // Notify monitors of successful run
        this.notifyMonitor(deviceId, 'nodeStatus', { nodeId, status: 'success', output: result.output });

        // Update local/global variables if node outputs them
        if (result.variables) {
          context.variables.local = { ...context.variables.local, ...result.variables };
        }

        // Determine next node based on output port
        const edge = graph.edges.find(
          (e) => e.source === nodeId && (!result.nextPort || e.sourceHandle === result.nextPort),
        );

        currentNode = edge ? nodesMap.get(edge.target) : undefined;
      } catch (err) {
        this.notifyMonitor(deviceId, 'nodeStatus', { nodeId, status: 'error', error: err.message });
        throw err;
      }
    }

    if (context.isRunning) {
      this.logger.log(`Workflow executed successfully on device: ${deviceId}`);
      this.notifyMonitor(deviceId, 'executionSuccess', { variables: context.variables });
      this.activeExecutions.delete(deviceId);
    }
  }

  private async executeNode(
    deviceId: string,
    node: WorkflowNode,
    context: ExecutionContext,
  ): Promise<{ nextPort?: string; variables?: any; output?: any }> {
    this.logger.log(`Executing node [${node.id}]: type=${node.type}`);
    const data = node.data || {};

    switch (node.type) {
      case 'start':
        return { nextPort: 'out-flow' };

      case 'delay':
        const delayMs = data.ms || 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { nextPort: 'out-flow' };

      case 'androidTapElement': {
        const selectorType = data.selectorType || 'xpath';
        const selectorValue = data.selectorValue;
        
        const result = await this.deviceGateway.sendCommandToDevice(deviceId, 'click', {
          type: selectorType,
          value: selectorValue,
        });
        
        return { nextPort: 'out-flow-success', output: result.message };
      }

      case 'androidInputText': {
        const selectorType = data.selectorType || 'xpath';
        const selectorValue = data.selectorValue;
        const text = data.text || '';
        
        const result = await this.deviceGateway.sendCommandToDevice(deviceId, 'input', {
          selectorType,
          selectorValue,
          text,
        });

        return { nextPort: 'out-flow-success', output: result.message };
      }

      case 'androidPressKey': {
        const key = data.key || 'BACK';
        const result = await this.deviceGateway.sendCommandToDevice(deviceId, 'pressKey', { key });
        return { nextPort: 'out-flow-success', output: result.message };
      }

      case 'controlIf': {
        const expression = data.expression || 'true';
        let evaluation = false;
        
        try {
          // Safe evaluation scope mapper
          const evalFunc = new Function('variables', `with(variables) { return (${expression}); }`);
          evaluation = evalFunc(context.variables);
        } catch (err) {
          throw new Error(`Failed to evaluate expression: ${err.message}`);
        }

        const nextPort = evaluation ? 'out-flow-true' : 'out-flow-false';
        return { nextPort, output: evaluation };
      }

      case 'setVariable': {
        const varName = data.name;
        const varVal = data.value;
        return {
          nextPort: 'out-flow',
          variables: { [varName]: varVal },
          output: { name: varName, value: varVal },
        };
      }

      default:
        throw new Error(`Unknown node execution type: ${node.type}`);
    }
  }

  private notifyMonitor(deviceId: string, event: string, payload: any) {
    this.deviceGateway.server.emit(event, { deviceId, ...payload });
  }
}
