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
  const xtermRef = useRef<XTermTerminal | null>(null);
  const xtermDiv = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventListenerRef = useRef<Function | null>(null);
  const xtermOnDataRef = useRef<IDisposable | null>(null);

  const sendInput = async (input: string) => {
    try {
      await call<[string, string], void>("send_terminal_input", terminalId, input);
    } catch (e) {
      console.error('Error sending input:', e);
    }
  };

  const connectIO = async () => {
    try {
      const xterm = xtermRef.current;
      if (!xterm || !xterm.element) {
        return;
      }

      // Create terminal on backend with our ID
      const createResult = await call<[string], boolean>("create_terminal", terminalId);
      if (!createResult) {
        xterm.write('--- Failed to create terminal ---\r\n');
        setLoaded(true);
        return;
      }

      // Set up input handler
      if (xtermOnDataRef.current) {
        xtermOnDataRef.current.dispose();
      }

      xtermOnDataRef.current = xterm.onData((data: string) => {
        sendInput(data);
      });

      // Set up event listener for output
      const unsubscribe = addEventListener<[string]>(`terminal_output#${terminalId}`, (data) => {
        xterm.write(data[0]);
      });
      eventListenerRef.current = unsubscribe;

      // Subscribe to terminal
      await call<[string], boolean>("subscribe_terminal", terminalId);

      // Request initial buffer
      await call<[string], boolean>("send_terminal_buffer", terminalId);

      setLoaded(true);
      if (onMounted && xterm) {
        onMounted(xterm);
      }
    } catch (error) {
      console.error('connectIO error:', error);
      xtermRef.current?.write('--- Error connecting to terminal ---\r\n');
      setLoaded(true);
    }
  };

  const initializeTerminal = async () => {
    const xterm = xtermRef.current;
    const div = xtermDiv.current;

    if (!xterm || !div) return;

    // Set up FitAddon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Open terminal
    await xterm.open(div);

    // Fit to container
    fitAddon.fit();

    // Set initial window size
    await call<[string, number, number], void>(
      "change_terminal_window_size",
      terminalId,
      xterm.rows,
      xterm.cols
    );

    xterm.focus();
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

  return (
    <div style={{ width: '100%' }}>
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
