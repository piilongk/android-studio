import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { Edge, Node, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedDevice: string;
  onlineDevices: string[];
  isRunning: boolean;
  isPaused: boolean;
  activeNodeId?: string;
  variables: Record<string, any>;
  breakpoints: Set<string>;
  history: { nodes: Node[]; edges: Edge[] }[];
  historyIndex: number;
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelectedDevice: (deviceId: string) => void;
  setOnlineDevices: (devices: string[]) => void;
  
  // Controls
  startExecution: () => Promise<void>;
  pauseExecution: () => Promise<void>;
  resumeExecution: () => Promise<void>;
  stopExecution: () => Promise<void>;
  toggleBreakpoint: (nodeId: string) => Promise<void>;

  // Undo/Redo & Utility
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  updateNodeData: (nodeId: string, data: any) => void;
}

const API_URL = 'http://localhost:3000';

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [
    {
      id: 'start-node',
      type: 'start',
      position: { x: 100, y: 150 },
      data: { label: 'Bắt đầu' },
    },
  ],
  edges: [],
  selectedDevice: '',
  onlineDevices: [],
  isRunning: false,
  isPaused: false,
  variables: { global: {}, local: {} },
  breakpoints: new Set(),
  history: [],
  historyIndex: -1,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    const nextNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: nextNodes });
  },

  onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    set({ edges: nextEdges });
  },

  onConnect: (connection) => {
    const nextEdges = addEdge(connection, get().edges);
    set({ edges: nextEdges });
    get().saveHistory();
  },

  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  setOnlineDevices: (onlineDevices) => set({ onlineDevices }),

  startExecution: async () => {
    const { selectedDevice, nodes, edges } = get();
    if (!selectedDevice) return;

    set({ isRunning: true, isPaused: false, activeNodeId: undefined });

    await fetch(`${API_URL}/workflow/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: selectedDevice,
        graph: { nodes, edges },
      }),
    });
  },

  pauseExecution: async () => {
    const { selectedDevice } = get();
    if (!selectedDevice) return;

    await fetch(`${API_URL}/workflow/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: selectedDevice }),
    });
  },

  resumeExecution: async () => {
    const { selectedDevice } = get();
    if (!selectedDevice) return;

    await fetch(`${API_URL}/workflow/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: selectedDevice }),
    });
  },

  stopExecution: async () => {
    const { selectedDevice } = get();
    if (!selectedDevice) return;

    await fetch(`${API_URL}/workflow/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: selectedDevice }),
    });
    set({ isRunning: false, isPaused: false, activeNodeId: undefined });
  },

  toggleBreakpoint: async (nodeId) => {
    const { selectedDevice, breakpoints } = get();
    const nextBreakpoints = new Set(breakpoints);
    const active = !breakpoints.has(nodeId);

    if (active) {
      nextBreakpoints.add(nodeId);
    } else {
      nextBreakpoints.delete(nodeId);
    }
    set({ breakpoints: nextBreakpoints });

    if (selectedDevice) {
      await fetch(`${API_URL}/workflow/breakpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: selectedDevice, nodeId, active }),
      });
    }
  },

  saveHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ nodes, edges });
    set({
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        historyIndex: historyIndex - 1,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      set({
        nodes: next.nodes,
        edges: next.edges,
        historyIndex: historyIndex + 1,
      });
    }
  },

  updateNodeData: (nodeId, data) => {
    const nextNodes = get().nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });
    set({ nodes: nextNodes });
    get().saveHistory();
  },
}));
