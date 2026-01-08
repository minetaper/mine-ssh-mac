import React, { useState } from 'react';
import { Server, Plus, Trash2, Search } from 'lucide-react';

interface SidebarProps {
  sessions: { id: string; name: string }[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onCloseSession: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewSession,
  onCloseSession
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-64 bg-zinc-900/50 flex flex-col border-r border-white/5 h-full pt-12">
      {/* Search & Add Header */}
      <div className="h-12 flex items-center gap-2 px-3 shrink-0 border-b border-white/5 bg-zinc-900/30">
        <div className="flex-1 relative group">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg pl-8 pr-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/30 focus:bg-black/40 transition-all"
            />
        </div>
        <button 
          onClick={onNewSession}
          className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all shadow-lg shadow-blue-900/20"
          title="New Connection"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 space-y-1">
          <div className="text-[10px] font-bold text-gray-600 px-3 py-2 uppercase tracking-widest">
            {searchTerm ? 'Search Results' : 'Active Sessions'}
          </div>
          {filteredSessions.map(session => (
            <div 
              key={session.id}
              className={`
                group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all duration-200
                ${activeSessionId === session.id 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                    : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'}
              `}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Server className={`w-4 h-4 shrink-0 ${activeSessionId === session.id ? 'text-blue-200' : 'text-gray-500'}`} />
                <span className="truncate font-medium">{session.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseSession(session.id);
                }}
                className={`
                    p-1 rounded opacity-0 group-hover:opacity-100 transition-all
                    ${activeSessionId === session.id ? 'hover:bg-blue-500 text-blue-100' : 'hover:bg-white/10 text-gray-400 hover:text-red-400'}
                `}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          
          {sessions.length === 0 && (
            <div className="text-center py-12 opacity-50">
              <p className="text-gray-500 text-xs">No sessions</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 border-t border-white/5 bg-black/20 text-[10px] text-gray-600 flex justify-between items-center">
        <span>v1.0.0</span>
        <div className="flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
