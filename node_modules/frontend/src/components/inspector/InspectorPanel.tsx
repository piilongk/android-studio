import React, { useEffect, useRef, useState } from 'react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import io from 'socket.io-client';
import {
  PhoneAndroid,
  CopyAll,
  AccountTree,
} from '@mui/icons-material';

interface AccessibilityNode {
  className: string;
  text: string;
  resourceId: string;
  contentDescription: string;
  bounds: string;
  clickable: boolean;
  children?: AccessibilityNode[];
}

export const InspectorPanel: React.FC = () => {
  const { selectedDevice } = useWorkflowStore();
  const [treeData, setTreeData] = useState<AccessibilityNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<AccessibilityNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<AccessibilityNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<any>(null);

  // Parse bounds string "[left,top][right,bottom]" into Rect values
  const parseBounds = (boundsStr: string) => {
    const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (match) {
      return {
        left: parseInt(match[1]),
        top: parseInt(match[2]),
        right: parseInt(match[3]),
        bottom: parseInt(match[4]),
      };
    }
    return null;
  };

  useEffect(() => {
    if (!selectedDevice) return;

    // Connect to WebSocket gateway namespace
    const socket = io('http://localhost:3000/device');
    socketRef.current = socket;

    socket.emit('subscribeDevice', { deviceId: selectedDevice });

    // Handle screen UI tree dumps from Android Agent
    socket.on('screenUpdate', (data: { tree: AccessibilityNode }) => {
      setTreeData(data.tree);
    });

    // Handle live JPEG screen frame updates (simplified scrcpy player)
    socket.on('videoFrame', (base64Frame: string) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = `data:image/jpeg;base64,${base64Frame}`;
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedDevice]);

  // Click on screen mirror canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !selectedDevice) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 720;
    const y = ((e.clientY - rect.top) / rect.height) * 1280;

    // Send touch command to server
    fetch('http://localhost:3000/workflow/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: selectedDevice,
        graph: {
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
            {
              id: 'tap',
              type: 'androidTapElement',
              position: { x: 0, y: 100 },
              data: { selectorType: 'coordinates', selectorValue: `${Math.round(x)},${Math.round(y)}` },
            },
          ],
          edges: [{ id: 'e1', source: 'start', target: 'tap' }],
        },
      }),
    });
  };

  const renderTree = (node: AccessibilityNode, depth = 0) => {
    const label = `${node.className.split('.').pop() || 'View'} ${
      node.text ? `("${node.text}")` : ''
    } ${node.resourceId ? `[id: ${node.resourceId.split('/').pop()}]` : ''}`;

    return (
      <div key={node.bounds + node.className} style={{ marginLeft: `${depth * 12}px` }}>
        <div
          onClick={() => setSelectedNode(node)}
          onMouseEnter={() => setHoveredNode(node)}
          onMouseLeave={() => setHoveredNode(null)}
          style={{
            padding: '4px 6px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '12px',
            color: selectedNode === node ? '#60a5fa' : '#d4d4d8',
            background: selectedNode === node ? 'rgba(59, 130, 246, 0.2)' : hoveredNode === node ? 'rgba(255,255,255,0.05)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <AccountTree fontSize="inherit" style={{ opacity: 0.7 }} />
          {label}
        </div>
        {node.children && node.children.map((child) => renderTree(child, depth + 1))}
      </div>
    );
  };

  const generateXPath = (node: AccessibilityNode): string => {
    if (node.resourceId) {
      return `//${node.className}[@resource-id='${node.resourceId}']`;
    }
    if (node.text) {
      return `//${node.className}[@text='${node.text}']`;
    }
    return `//${node.className}[@bounds='${node.bounds}']`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#09090b', borderLeft: '1px solid #27272a' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', borderBottom: '1px solid #27272a', color: '#fff' }}>
        <PhoneAndroid style={{ color: '#60a5fa' }} />
        <span style={{ fontWeight: 'bold' }}>Trình Giám Sát & Soi Phần Tử (Inspector)</span>
      </div>

      {/* Main Split */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Live Screen Mirror */}
        <div style={{ flex: 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', background: '#18181b' }}>
          <div style={{ position: 'relative', width: '270px', height: '480px', border: '8px solid #27272a', borderRadius: '16px', overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={270}
              height={480}
              onClick={handleCanvasClick}
              style={{ cursor: 'pointer', background: '#000' }}
            />
            {/* Draw Highlight box for selected or hovered elements */}
            {hoveredNode && parseBounds(hoveredNode.bounds) && (
              <div
                style={{
                  position: 'absolute',
                  border: '2px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.15)',
                  pointerEvents: 'none',
                  left: `${(parseBounds(hoveredNode.bounds)!.left / 720) * 270}px`,
                  top: `${(parseBounds(hoveredNode.bounds)!.top / 1280) * 480}px`,
                  width: `${((parseBounds(hoveredNode.bounds)!.right - parseBounds(hoveredNode.bounds)!.left) / 720) * 270}px`,
                  height: `${((parseBounds(hoveredNode.bounds)!.bottom - parseBounds(hoveredNode.bounds)!.top) / 1280) * 480}px`,
                }}
              />
            )}
            {selectedNode && parseBounds(selectedNode.bounds) && (
              <div
                style={{
                  position: 'absolute',
                  border: '2px solid #3b82f6',
                  background: 'rgba(59, 130, 246, 0.25)',
                  pointerEvents: 'none',
                  left: `${(parseBounds(selectedNode.bounds)!.left / 720) * 270}px`,
                  top: `${(parseBounds(selectedNode.bounds)!.top / 1280) * 480}px`,
                  width: `${((parseBounds(selectedNode.bounds)!.right - parseBounds(selectedNode.bounds)!.left) / 720) * 270}px`,
                  height: `${((parseBounds(selectedNode.bounds)!.bottom - parseBounds(selectedNode.bounds)!.top) / 1280) * 480}px`,
                }}
              />
            )}
          </div>
        </div>

        {/* Hierarchy Tree */}
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #27272a', background: '#09090b' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #27272a', fontSize: '12px', fontWeight: 'bold', color: '#a1a1aa' }}>
            Accessibility Cây UI
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {treeData ? renderTree(treeData) : <div style={{ color: '#52525b', fontSize: '12px' }}>Chưa có cây UI dữ liệu. Đang đợi kết nối...</div>}
          </div>

          {/* Properties grid of Selected Element */}
          {selectedNode && (
            <div style={{ padding: '16px', borderTop: '1px solid #27272a', background: '#18181b', color: '#e4e4e7', fontSize: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#60a5fa' }}>Thuộc Tính Phần Tử</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Class:</strong> {selectedNode.className}</div>
                {selectedNode.text && <div><strong>Text:</strong> {selectedNode.text}</div>}
                {selectedNode.resourceId && <div><strong>ID:</strong> {selectedNode.resourceId}</div>}
                {selectedNode.contentDescription && <div><strong>Mô tả:</strong> {selectedNode.contentDescription}</div>}
                <div><strong>Tọa độ:</strong> {selectedNode.bounds}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', background: '#09090b', padding: '8px', borderRadius: '4px' }}>
                  <span style={{ fontFamily: 'monospace', overflowX: 'auto', flex: 1 }}>{generateXPath(selectedNode)}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(generateXPath(selectedNode))}
                    style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer' }}
                    title="Sao chép XPath"
                  >
                    <CopyAll fontSize="small" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
