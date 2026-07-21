import React from 'react';
import { Handle, Position } from 'reactflow';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import {
  PlayArrow,
  HourglassEmpty,
  TouchApp,
  Keyboard,
  CallSplit,
  Settings,
} from '@mui/icons-material';

const baseNodeStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #3f3f46',
  background: 'rgba(24, 24, 27, 0.9)',
  color: '#e4e4e7',
  fontFamily: 'Outfit, Inter, sans-serif',
  fontSize: '13px',
  width: '200px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
};

const titleStyle: React.CSSProperties = {
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
  borderBottom: '1px solid #27272a',
  paddingBottom: '4px',
};

const inputContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginTop: '4px',
};

const inputStyle: React.CSSProperties = {
  background: '#09090b',
  border: '1px solid #27272a',
  borderRadius: '4px',
  color: '#e4e4e7',
  padding: '4px 8px',
  fontSize: '12px',
};

const selectStyle: React.CSSProperties = {
  background: '#09090b',
  border: '1px solid #27272a',
  borderRadius: '4px',
  color: '#e4e4e7',
  padding: '4px',
  fontSize: '12px',
};

export const StartNode = () => (
  <div style={{ ...baseNodeStyle, borderLeft: '4px solid #10b981' }}>
    <div style={titleStyle}>
      <PlayArrow style={{ color: '#10b981' }} />
      Bắt đầu
    </div>
    <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Điểm xuất phát kịch bản</div>
    <Handle type="source" position={Position.Bottom} id="out-flow" style={{ background: '#10b981', width: '8px', height: '8px' }} />
  </div>
);

export const DelayNode = ({ id, data }: { id: string; data: any }) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <div style={{ ...baseNodeStyle, borderLeft: '4px solid #f59e0b' }}>
      <Handle type="target" position={Position.Top} id="in-flow" style={{ background: '#3b82f6', width: '8px', height: '8px' }} />
      <div style={titleStyle}>
        <HourglassEmpty style={{ color: '#f59e0b' }} />
        Trễ (Delay)
      </div>
      <div style={inputContainerStyle}>
        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Mili giây (ms)</span>
        <input
          type="number"
          style={inputStyle}
          value={data.ms || 1000}
          onChange={(e) => updateNodeData(id, { ms: parseInt(e.target.value) || 0 })}
        />
      </div>
      <Handle type="source" position={Position.Bottom} id="out-flow" style={{ background: '#10b981', width: '8px', height: '8px' }} />
    </div>
  );
};

export const TapNode = ({ id, data }: { id: string; data: any }) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <div style={{ ...baseNodeStyle, borderLeft: '4px solid #3b82f6' }}>
      <Handle type="target" position={Position.Top} id="in-flow" style={{ background: '#3b82f6', width: '8px', height: '8px' }} />
      <div style={titleStyle}>
        <TouchApp style={{ color: '#3b82f6' }} />
        Chạm UI Element
      </div>
      <div style={inputContainerStyle}>
        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Bộ chọn (Selector)</span>
        <select
          style={selectStyle}
          value={data.selectorType || 'xpath'}
          onChange={(e) => updateNodeData(id, { selectorType: e.target.value })}
        >
          <option value="xpath">XPath</option>
          <option value="id">Resource ID</option>
          <option value="text">Chữ (Text)</option>
          <option value="description">Mô tả (Desc)</option>
        </select>
        <input
          type="text"
          style={inputStyle}
          placeholder="Giá trị selector..."
          value={data.selectorValue || ''}
          onChange={(e) => updateNodeData(id, { selectorValue: e.target.value })}
        />
      </div>
      <Handle type="source" position={Position.Bottom} id="out-flow-success" style={{ background: '#10b981', width: '8px', height: '8px' }} />
    </div>
  );
};

export const InputNode = ({ id, data }: { id: string; data: any }) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <div style={{ ...baseNodeStyle, borderLeft: '4px solid #8b5cf6' }}>
      <Handle type="target" position={Position.Top} id="in-flow" style={{ background: '#3b82f6', width: '8px', height: '8px' }} />
      <div style={titleStyle}>
        <Keyboard style={{ color: '#8b5cf6' }} />
        Nhập chữ (Input)
      </div>
      <div style={inputContainerStyle}>
        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Phần tử nhận chữ</span>
        <select
          style={selectStyle}
          value={data.selectorType || 'xpath'}
          onChange={(e) => updateNodeData(id, { selectorType: e.target.value })}
        >
          <option value="xpath">XPath</option>
          <option value="id">Resource ID</option>
          <option value="text">Text</option>
        </select>
        <input
          type="text"
          style={inputStyle}
          placeholder="Selector..."
          value={data.selectorValue || ''}
          onChange={(e) => updateNodeData(id, { selectorValue: e.target.value })}
        />
        <span style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '4px' }}>Nội dung nhập</span>
        <input
          type="text"
          style={inputStyle}
          placeholder="Nhập chuỗi..."
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
        />
      </div>
      <Handle type="source" position={Position.Bottom} id="out-flow-success" style={{ background: '#10b981', width: '8px', height: '8px' }} />
    </div>
  );
};

export const IfNode = ({ id, data }: { id: string; data: any }) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <div style={{ ...baseNodeStyle, borderLeft: '4px solid #ec4899', width: '220px' }}>
      <Handle type="target" position={Position.Top} id="in-flow" style={{ background: '#3b82f6', width: '8px', height: '8px' }} />
      <div style={titleStyle}>
        <CallSplit style={{ color: '#ec4899' }} />
        Nếu/Thì (If/Else)
      </div>
      <div style={inputContainerStyle}>
        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Biểu thức điều kiện</span>
        <input
          type="text"
          style={inputStyle}
          placeholder="e.g. variables.local.battery < 20"
          value={data.expression || ''}
          onChange={(e) => updateNodeData(id, { expression: e.target.value })}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px' }}>
        <span style={{ color: '#10b981' }}>Đúng (True)</span>
        <span style={{ color: '#ef4444' }}>Sai (False)</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-flow-true"
        style={{ left: '25%', background: '#10b981', width: '8px', height: '8px' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out-flow-false"
        style={{ left: '75%', background: '#ef4444', width: '8px', height: '8px' }}
      />
    </div>
  );
};

export const SetVarNode = ({ id, data }: { id: string; data: any }) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <div style={{ ...baseNodeStyle, borderLeft: '4px solid #06b6d4' }}>
      <Handle type="target" position={Position.Top} id="in-flow" style={{ background: '#3b82f6', width: '8px', height: '8px' }} />
      <div style={titleStyle}>
        <Settings style={{ color: '#06b6d4' }} />
        Gán Biến
      </div>
      <div style={inputContainerStyle}>
        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Tên biến</span>
        <input
          type="text"
          style={inputStyle}
          placeholder="e.g. counter"
          value={data.name || ''}
          onChange={(e) => updateNodeData(id, { name: e.target.value })}
        />
        <span style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '4px' }}>Giá trị</span>
        <input
          type="text"
          style={inputStyle}
          placeholder="e.g. 10"
          value={data.value || ''}
          onChange={(e) => updateNodeData(id, { value: e.target.value })}
        />
      </div>
      <Handle type="source" position={Position.Bottom} id="out-flow" style={{ background: '#10b981', width: '8px', height: '8px' }} />
    </div>
  );
};
