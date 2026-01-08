import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Terminal from './components/Terminal';
import AIChat from './components/AIChat';
import { X, Server, Settings } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  config?: any;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
  // AI Chat State
  const [showAIChat, setShowAIChat] = useState(true);
  const [showAIConfig, setShowAIConfig] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    host: '',
    port: '22',
    username: '',
    password: '',
  });

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowNewConnectionModal(false);

    try {
      const config = {
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username,
        password: formData.password,
      };

      const result = await window.electronAPI.connectSSH(config);
      
      const newSession: Session = {
        id: result.id,
        name: `${formData.username}@${formData.host}`,
        config,
        status: 'connected'
      };

      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);

      // Reset form
      setFormData({ host: '', port: '22', username: '', password: '' });

    } catch (err: any) {
      alert(`Connection failed: ${err}`);
    }
  };

  const closeSession = (id: string) => {
    window.electronAPI.disconnectSSH(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 overflow-hidden font-sans relative">
        
        {/* Sidebar - Full height, left aligned */}
        <div className="w-64 shrink-0 h-full relative z-50 border-r border-white/5">
            {/* Draggable Header for Sidebar - Matches h-12 */}
            <div className="absolute top-0 left-0 right-0 h-12 drag-region bg-transparent" />
            <Sidebar 
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={setActiveSessionId}
                onNewSession={() => setShowNewConnectionModal(true)}
                onCloseSession={closeSession}
            />
        </div>

        {/* Main Content Area - Contains Terminal & Chat Side-by-Side */}
        <div className="flex-1 flex min-w-0 bg-[#121212] relative">
            
            {/* Terminal Column */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Terminal Header - h-12, aligned with Terminal Content */}
                <div className="h-12 flex items-center justify-between px-4 drag-region shrink-0 z-50 bg-transparent relative border-b border-white/5">
                     {/* Center: App Title / Status - Absolute Centered in this header */}
                     <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-900/80 backdrop-blur-md rounded-full border border-white/5 shadow-lg">
                            <div className={`w-2 h-2 rounded-full ${activeSession?.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
                            <span className="text-sm font-medium text-gray-300 font-mono tracking-wide">
                            {activeSession ? activeSession.name : 'Mine SSH'}
                            </span>
                        </div>
                     </div>

                    {/* Right: AI Toggle (Visible when Chat is CLOSED) */}
                    {/* Actually, let's keep it here always? Or move it to Chat Header when open? */}
                    {/* If we keep it here, it will be to the left of Chat Panel when Chat is open. */}
                    {/* Let's try keeping it here. */}
                    <div className="flex-1" /> {/* Spacer */}
                    <div className="flex justify-end no-drag z-10">
                         <button 
                            onClick={() => setShowAIChat(!showAIChat)}
                            className={`
                                text-xs font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2
                                ${showAIChat 
                                    ? 'bg-blue-600/90 border-blue-500/50 text-white shadow-lg shadow-blue-900/50' 
                                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'}
                            `}
                        >
                            <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            AI
                        </button>
                    </div>
                </div>

                {/* Terminal Content */}
                <div className="flex-1 relative bg-[#09090b] overflow-hidden">
                    {sessions.map(session => (
                    <div 
                        key={session.id} 
                        className={`absolute inset-0 p-2 ${activeSessionId === session.id ? 'z-10 visible' : 'z-0 invisible'}`}
                    >
                        <Terminal id={session.id} isActive={activeSessionId === session.id} />
                    </div>
                    ))}
                    
                    {sessions.length === 0 && (
                    <div className="flex items-center justify-center h-full text-gray-500 bg-zinc-950">
                        <div className="text-center p-8 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm shadow-xl max-w-sm">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Server className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Welcome to MineSSH</h3>
                        <p className="mb-6 text-gray-400 text-sm">Connect to your server to get started with AI-powered operations.</p>
                        <button 
                            onClick={() => setShowNewConnectionModal(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/50 hover:shadow-blue-900/80"
                        >
                            Connect to Server
                        </button>
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* AI Chat Column - Full Height Side-by-Side */}
            {showAIChat && (
                <div className="w-80 shrink-0 bg-zinc-900 border-l border-white/5 flex flex-col z-10 relative">
                     {/* AI Chat Header - Matches h-12 */}
                     <div className="h-12 flex items-center justify-end px-4 border-b border-white/5 bg-transparent drag-region shrink-0">
                         {/* Settings Button moved here */}
                        <button 
                            onClick={() => setShowAIConfig(!showAIConfig)}
                            className={`
                                p-1.5 rounded-lg border transition-all no-drag
                                ${showAIConfig 
                                    ? 'bg-zinc-700 border-white/20 text-white' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                            `}
                            title="AI Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                     </div>
                     
                    <div className="flex-1 min-h-0 relative">
                        <AIChat 
                            activeSessionId={activeSessionId} 
                            showConfig={showAIConfig}
                            setShowConfig={setShowAIConfig}
                        />
                    </div>
                </div>
            )}
        </div>
      
      {/* New Connection Modal */}
      {showNewConnectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl shadow-2xl w-96 p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">New Connection</h2>
              <button onClick={() => setShowNewConnectionModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Host</label>
                <input
                  type="text"
                  required
                  value={formData.host}
                  onChange={e => setFormData({...formData, host: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="192.168.1.1"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Port</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={e => setFormData({...formData, port: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="22"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="root"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/50 hover:shadow-blue-900/80 mt-2"
              >
                Connect
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
