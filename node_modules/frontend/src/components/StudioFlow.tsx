import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
} from 'reactflow';
import type { Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '../store/useWorkflowStore';
import {
  StartNode,
  DelayNode,
  TapNode,
  InputNode,
  IfNode,
  SetVarNode,
} from './nodes/CustomNodes';
import { Undo, Redo, AddCircleOutlined } from '@mui/icons-material';

const nodeTypes = {
  start: StartNode,
  delay: DelayNode,
  androidTapElement: TapNode,
  androidInputText: InputNode,
  controlIf: IfNode,
  setVariable: SetVarNode,
};

export const StudioFlow: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    undo,
    redo,
    setNodes,
    saveHistory,
    activeNodeId,
    breakpoints,
    toggleBreakpoint,
  } = useWorkflowStore();

  // Add node helper
  const addNode = (type: string) => {
    const id = `${type}-${Math.random().toString(36).substring(2, 9)}`;
    const newNode: Node = {
      id,
      type,
      position: { x: Math.random() * 250 + 100, y: Math.random() * 250 + 100 },
      data: { label: `Node ${type}` },
    };
    setNodes([...nodes, newNode]);
    saveHistory();
  };

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // Toggle breakpoint on right click
      toggleBreakpoint(node.id);
    },
    [toggleBreakpoint]
  );

  // Map nodes to add styles if running/paused/breakpoint
  const styledNodes = nodes.map((node) => {
    const isBreakpoint = breakpoints.has(node.id);
    const isActive = activeNodeId === node.id;
    
    let borderStyle = {};
    if (isActive) {
      borderStyle = { boxShadow: '0 0 15px #10b981', transform: 'scale(1.02)' };
    } else if (isBreakpoint) {
      borderStyle = { border: '2px dashed #ef4444' };
    }

    return {
      ...node,
      style: {
        ...node.style,
        ...borderStyle,
        transition: 'all 0.2s ease',
      },
    };
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#09090b' }}>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeContextMenu={onNodeContextMenu}
        fitView
      >
        <Background color="#27272a" gap={16} size={1} />
        <Controls style={{ background: '#18181b', border: '1px solid #27272a', color: '#fff' }} />
        <MiniMap
          style={{ background: '#18181b', border: '1px solid #27272a' }}
          maskColor="rgba(24, 24, 27, 0.7)"
          nodeColor={(n) => {
            if (n.type === 'start') return '#10b981';
            if (n.type === 'controlIf') return '#ec4899';
            return '#3b82f6';
          }}
        />

        <Panel position="top-left" style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              background: 'rgba(24, 24, 27, 0.95)',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#e4e4e7', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AddCircleOutlined fontSize="small" style={{ color: '#3b82f6' }} />
              Thêm Node
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button onClick={() => addNode('delay')} style={buttonStyle}>Trễ (Delay)</button>
              <button onClick={() => addNode('androidTapElement')} style={buttonStyle}>Chạm Element</button>
              <button onClick={() => addNode('androidInputText')} style={buttonStyle}>Nhập Chữ</button>
              <button onClick={() => addNode('controlIf')} style={buttonStyle}>Nhánh If</button>
              <button onClick={() => addNode('setVariable')} style={buttonStyle}>Gán Biến</button>
            </div>
          </div>
        </Panel>

        <Panel position="top-right" style={{ display: 'flex', gap: '6px' }}>
          <button onClick={undo} style={iconButtonStyle} title="Undo">
            <Undo fontSize="small" />
          </button>
          <button onClick={redo} style={iconButtonStyle} title="Redo">
            <Redo fontSize="small" />
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  background: '#18181b',
  border: '1px solid #27272a',
  color: '#e4e4e7',
  padding: '6px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'background 0.2s',
};

const iconButtonStyle: React.CSSProperties = {
  background: 'rgba(24, 24, 27, 0.95)',
  border: '1px solid #27272a',
  color: '#e4e4e7',
  padding: '8px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
