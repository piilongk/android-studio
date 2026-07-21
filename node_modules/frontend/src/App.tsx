import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from './store/useWorkflowStore';
import { StudioFlow } from './components/StudioFlow';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import io from 'socket.io-client';
import {
  Refresh,
  PlayArrow,
  Pause,
  Stop,
  AutoFixHigh,
} from '@mui/icons-material';

const App: React.FC = () => {
  const {
    selectedDevice,
    setSelectedDevice,
    onlineDevices,
    setOnlineDevices,
    isRunning,
    isPaused,
    startExecution,
    pauseExecution,
    resumeExecution,
    stopExecution,
    variables,
  } = useWorkflowStore();

  const [activeTab, setActiveTab] = useState<'variables' | 'console'>('variables');
  const [logs, setLogs] = useState<string[]>([]);

  // Fetch online devices list
  const refreshDevices = async () => {
    try {
      const res = await fetch('http://localhost:3000/devices');
      const data = await res.json();
      setOnlineDevices(data);
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  };

  useEffect(() => {
    refreshDevices();
    const interval = setInterval(refreshDevices, 4000);

    // Dynamic execution monitoring updates via WebSocket
    const socket = io('http://localhost:3000/device');

    socket.on('nodeStatus', (data: { deviceId: string; nodeId: string; status: string; error?: string; output?: any }) => {
      const timestamp = new Date().toLocaleTimeString();
      let logMsg = `[${timestamp}] Node [${data.nodeId.split('-')[0]}] -> ${data.status.toUpperCase()}`;
      if (data.error) logMsg += ` (Lỗi: ${data.error})`;
      if (data.output) logMsg += ` (Kết quả: ${JSON.stringify(data.output)})`;
      
      setLogs((prev) => [...prev, logMsg]);

      // Highlight active node in zustand
      if (data.status === 'running' || data.status === 'paused') {
        useWorkflowStore.setState({ activeNodeId: data.nodeId, isPaused: data.status === 'paused' });
      } else if (data.status === 'success' || data.status === 'error') {
        useWorkflowStore.setState({ activeNodeId: undefined });
      }
    });

    socket.on('executionSuccess', (_data: { deviceId: string }) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] CHẠY THÀNH CÔNG WORKFLOW!`]);
      useWorkflowStore.setState({ isRunning: false, activeNodeId: undefined });
    });

    socket.on('executionFailed', (data: { error: string }) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] WORKFLOW THẤT BẠI: ${data.error}`]);
      useWorkflowStore.setState({ isRunning: false, activeNodeId: undefined });
    });

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [selectedDevice]);

  return (
    <div style={containerStyle}>
      {/* Top Header Controls Panel */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AutoFixHigh style={{ color: '#60a5fa', fontSize: '28px' }} />
          <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#fff', letterSpacing: '0.5px' }}>
            No-Code Automation Studio
          </span>
        </div>

        {/* Action controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Device selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Thiết bị:</span>
            <select
              style={selectStyle}
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              {onlineDevices.length === 0 ? (
                <option value="">Chưa tìm thấy thiết bị...</option>
              ) : (
                onlineDevices.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))
              )}
            </select>
            <button onClick={refreshDevices} style={headerButtonStyle}>
              <Refresh fontSize="small" />
            </button>
          </div>

          <div style={{ width: '1px', height: '24px', background: '#27272a' }} />

          {/* Running control actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isRunning ? (
              <button onClick={startExecution} disabled={!selectedDevice} style={{ ...actionButtonStyle, background: '#10b981' }}>
                <PlayArrow fontSize="small" /> Chạy
              </button>
            ) : isPaused ? (
              <button onClick={resumeExecution} style={{ ...actionButtonStyle, background: '#10b981' }}>
                <PlayArrow fontSize="small" /> Tiếp tục
              </button>
            ) : (
              <button onClick={pauseExecution} style={{ ...actionButtonStyle, background: '#f59e0b' }}>
                <Pause fontSize="small" /> Tạm dừng
              </button>
            )}

            <button onClick={stopExecution} disabled={!isRunning} style={{ ...actionButtonStyle, background: '#ef4444' }}>
              <Stop fontSize="small" /> Dừng
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Body Workspace */}
      <main style={mainStyle}>
        {/* Left Side: ReactFlow Visual Node Designer */}
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1.5, position: 'relative' }}>
            <StudioFlow />
          </div>

          {/* Variables and Console Log Panel */}
          <div style={consoleContainerStyle}>
            <div style={tabHeaderStyle}>
              <button
                onClick={() => setActiveTab('variables')}
                style={{ ...tabButtonStyle, borderBottom: activeTab === 'variables' ? '2px solid #3b82f6' : 'none', color: activeTab === 'variables' ? '#3b82f6' : '#a1a1aa' }}
              >
                Watch Variables (Theo dõi biến)
              </button>
              <button
                onClick={() => setActiveTab('console')}
                style={{ ...tabButtonStyle, borderBottom: activeTab === 'console' ? '2px solid #3b82f6' : 'none', color: activeTab === 'console' ? '#3b82f6' : '#a1a1aa' }}
              >
                Output Console Logs (Nhật ký)
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {activeTab === 'variables' ? (
                <pre style={codeOutputStyle}>
                  {JSON.stringify(variables, null, 2)}
                </pre>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {logs.map((log, idx) => (
                    <div key={idx} style={{ fontFamily: 'monospace', fontSize: '12px', color: '#10b981' }}>
                      {log}
                    </div>
                  ))}
                  {logs.length === 0 && <div style={{ color: '#52525b', fontSize: '12px' }}>Chưa có log ghi nhận. Nhấn Chạy để xem kịch bản.</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Device Screen Inspector */}
        <div style={{ flex: 1.1, height: '100%' }}>
          <InspectorPanel />
        </div>
      </main>
    </div>
  );
};

// CSS styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100vw',
  height: '100vh',
  background: '#09090b',
  color: '#e4e4e7',
  fontFamily: 'Outfit, Inter, sans-serif',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 24px',
  background: 'rgba(24, 24, 27, 0.95)',
  borderBottom: '1px solid #27272a',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const selectStyle: React.CSSProperties = {
  background: '#09090b',
  border: '1px solid #27272a',
  borderRadius: '6px',
  color: '#e4e4e7',
  padding: '6px 12px',
  fontSize: '13px',
  outline: 'none',
};

const headerButtonStyle: React.CSSProperties = {
  background: '#18181b',
  border: '1px solid #27272a',
  color: '#e4e4e7',
  padding: '6px 8px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const actionButtonStyle: React.CSSProperties = {
  border: 'none',
  color: '#fff',
  padding: '6px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'opacity 0.2s',
};

const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const consoleContainerStyle: React.CSSProperties = {
  flex: 0.5,
  borderTop: '1px solid #27272a',
  background: '#09090b',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const tabHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  borderBottom: '1px solid #27272a',
  background: '#18181b',
  padding: '0 16px',
};

const tabButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '12px 6px',
  fontSize: '12px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const codeOutputStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  background: '#020202',
  padding: '8px',
  borderRadius: '4px',
  color: '#60a5fa',
  margin: 0,
};

export default App;
