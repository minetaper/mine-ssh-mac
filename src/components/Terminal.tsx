import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalProps {
  id: string;
  isActive: boolean;
}

const Terminal: React.FC<TerminalProps> = ({ id, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#09090b', // Match bg-zinc-950
        foreground: '#ffffff',
        cursor: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      window.electronAPI.sendSSHInput(id, data);
    });

    term.onResize(({ cols, rows }) => {
      window.electronAPI.resizeSSH(id, rows, cols);
    });

    // Initial resize
    window.electronAPI.resizeSSH(id, term.rows, term.cols);

    const handleResize = () => {
      fitAddon.fit();
      window.electronAPI.resizeSSH(id, term.rows, term.cols);
    };

    window.addEventListener('resize', handleResize);

    const cleanupData = window.electronAPI.onSSHData((_, { id: msgId, data }) => {
      if (msgId === id) {
        term.write(data);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupData();
      term.dispose();
    };
  }, [id]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (xtermRef.current) {
            window.electronAPI.resizeSSH(id, xtermRef.current.rows, xtermRef.current.cols);
        }
      }, 100);
    }
  }, [isActive, id]);

  return <div className="h-full w-full bg-zinc-950" ref={terminalRef} />;
};

export default Terminal;
