import { FC, useRef, useState, useEffect } from "react";
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { call, addEventListener, removeEventListener } from "@decky/api";
import XTermCSS from "../common/xterm_css";
import { IDisposable } from '@xterm/xterm';

interface SidebarTerminalProps {
  height?: string;
  onMounted?: (terminal: XTermTerminal) => void;
}

const SidebarTerminal: FC<SidebarTerminalProps> = ({ height = "300px", onMounted }) => {
  const [terminalId] = useState(() => 'sidebar-term-' + Math.random().toString(36).substr(2, 9));
  const [loaded, setLoaded] = useState(false);
  const [frontendLogs, setFrontendLogs] = useState<string>('');
  const [backendLogs, setBackendLogs] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const xtermDiv = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventListenerRef = useRef<Function | null>(null);
  const xtermOnDataRef = useRef<IDisposable | null>(null);

  const log = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    setFrontendLogs(prev => prev + logMsg);
    console.log(msg);
  };

  const sendInput = async (input: string) => {
    try {
      await call<[string, string], void>("send_terminal_input", terminalId, input);
    } catch (e) {
      console.error('Error sending input:', e);
    }
  };

  const connectIO = async () => {
    try {
      log('=== connectIO START ===');
      const xterm = xtermRef.current;
      if (!xterm) {
        log('ERROR: xterm ref is null');
        return;
      }
      if (!xterm.element) {
        log('ERROR: xterm.element is null, terminal not opened');
        return;
      }
      log('xterm is ready');

      // Create terminal on backend with our ID
      log(`Calling create_terminal with id: ${terminalId}`);
      const createResult = await call<[string], boolean>("create_terminal", terminalId);
      log(`create_terminal returned: ${createResult}`);
      if (!createResult) {
        xterm.write('--- Failed to create terminal ---\r\n');
        setLoaded(true);
        log('ERROR: create_terminal returned false');
        return;
      }
      log('Terminal created successfully');

      // Set up input handler
      if (xtermOnDataRef.current) {
        xtermOnDataRef.current.dispose();
      }

      xtermOnDataRef.current = xterm.onData((data: string) => {
        log(`Input: ${repr(data)}`);
        sendInput(data);
      });
      log('Input handler registered');

      // Set up event listener for output
      log(`Setting up event listener for terminal_output#${terminalId}`);
      const unsubscribe = addEventListener<[string]>(`terminal_output#${terminalId}`, (data) => {
        log(`Received output event: ${data[0].length} bytes`);
        xterm.write(data[0]);
      });
      eventListenerRef.current = unsubscribe;
      log('Event listener registered');

      // Subscribe to terminal
      log('Calling subscribe_terminal');
      await call<[string], boolean>("subscribe_terminal", terminalId);
      log('Subscribed to terminal');

      // Request initial buffer
      log('Calling send_terminal_buffer');
      await call<[string], boolean>("send_terminal_buffer", terminalId);
      log('Initial buffer requested');

      setLoaded(true);
      log('=== connectIO COMPLETE ===');
      if (onMounted && xterm) {
        onMounted(xterm);
      }
    } catch (error) {
      log(`ERROR: ${error}`);
      console.error('connectIO error:', error);
      xtermRef.current?.write('--- Error connecting to terminal ---\r\n');
      setLoaded(true);
    }
  };

  // Helper to safely represent strings for logging
  const repr = (s: string): string => {
    if (s.length <= 50) {
      return JSON.stringify(s);
    }
    return JSON.stringify(s.substring(0, 50)) + '...';
  };

  const initializeTerminal = async () => {
    log('=== initializeTerminal START ===');
    const xterm = xtermRef.current;
    const div = xtermDiv.current;

    if (!xterm) {
      log('ERROR: xterm ref is null');
      return;
    }
    if (!div) {
      log('ERROR: xtermDiv ref is null');
      return;
    }
    log('Refs are ready');

    // Set up FitAddon
    log('Creating FitAddon');
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    log('FitAddon loaded');

    // Open terminal
    log('Opening xterm');
    await xterm.open(div);
    log(`xterm opened, size: ${xterm.rows}x${xterm.cols}`);

    // Fit to container
    log('Fitting to container');
    fitAddon.fit();
    log(`Fit complete, new size: ${xterm.rows}x${xterm.cols}`);

    // Set initial window size
    log(`Calling change_terminal_window_size: ${xterm.rows}x${xterm.cols}`);
    await call<[string, number, number], void>(
      "change_terminal_window_size",
      terminalId,
      xterm.rows,
      xterm.cols
    );
    log('Window size changed');

    xterm.focus();
    log('Terminal focused');
    log('=== initializeTerminal COMPLETE ===');
  };

  // Create xterm instance on mount
  useEffect(() => {
    const xterm = new XTermTerminal({
      allowProposedApi: true,
      cursorBlink: true,
      rows: 15,
      fontSize: 12,
      fontFamily: 'monospace',
    });

    xtermRef.current = xterm;

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []);

  // Initialize and connect when refs are ready
  useEffect(() => {
    if (xtermRef.current && xtermDiv.current) {
      initializeTerminal().then(() => connectIO());
    }

    return () => {
      // Clean up event listener
      if (eventListenerRef.current) {
        eventListenerRef.current();
        eventListenerRef.current = null;
      }

      // Clean up xterm
      if (xtermRef.current) {
        xtermRef.current.clear();
      }

      try {
        call<[string], void>("unsubscribe_terminal", terminalId);
      } catch (e) {
        console.error('Unsubscribe error:', e);
      }
    };
  }, []);

  const fitToScreen = () => {
    if (fitAddonRef.current && xtermRef.current) {
      fitAddonRef.current.fit();
    }
  };

  const refreshBackendLogs = async () => {
    try {
      log('Refreshing backend logs...');
      const logs = await call<[], string>("get_log");
      setBackendLogs(logs);
      log(`Backend logs loaded: ${logs.length} chars`);
    } catch (e) {
      log(`ERROR loading backend logs: ${e}`);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </button>
        {showLogs && (
          <button
            onClick={refreshBackendLogs}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Refresh Backend Logs
          </button>
        )}
      </div>

      {showLogs && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px' }}>Frontend Logs:</div>
          <pre style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            background: '#111',
            color: '#0f0',
            padding: '8px',
            borderRadius: '4px',
            maxHeight: '150px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {frontendLogs || 'No logs yet'}
          </pre>

          <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', marginTop: '8px' }}>Backend Logs:</div>
          <pre style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            background: '#111',
            color: '#0ff',
            padding: '8px',
            borderRadius: '4px',
            maxHeight: '150px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {backendLogs || 'Click "Refresh Backend Logs"'}
          </pre>
        </div>
      )}

      <XTermCSS />
      <div
        ref={xtermDiv}
        style={{
          width: '100%',
          background: '#000',
          padding: '4px',
          height: height,
          borderRadius: '4px',
          overflow: 'hidden'
        }}
        onClick={() => xtermRef.current?.focus()}
      />
      {!loaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '12px'
        }}>
          Loading terminal...
        </div>
      )}
    </div>
  );
};

export default SidebarTerminal;
