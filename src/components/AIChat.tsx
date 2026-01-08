import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Settings, Loader2, Book, Plus, Trash2, X, Square } from 'lucide-react';

interface AIConfig {
  baseUrl: string;
  model: string;
  provider: 'ollama' | 'openai' | 'deepseek';
  apiKey?: string;
}

interface Prompt {
  id: string;
  title: string;
  content: string;
}

interface AIChatProps {
  activeSessionId: string | null;
  showConfig: boolean;
  setShowConfig: (show: boolean) => void;
}

const AIChat: React.FC<AIChatProps> = ({ activeSessionId, showConfig, setShowConfig }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai' | 'system'; content: string; hidden?: boolean }[]>([
    
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentCmd, setCurrentCmd] = useState<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, currentCmd]);

  // showConfig and setShowConfig are now props
  const [config, setConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('minessh_ai_config');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Migration for old config
        if (!parsed.provider) parsed.provider = 'ollama';
        return parsed;
    }
    return {
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3',
      provider: 'ollama',
      apiKey: ''
    };
  });

  // Prompts state
  const [showPrompts, setShowPrompts] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>('1');
  const [prompts, setPrompts] = useState<Prompt[]>(() => {
    const saved = localStorage.getItem('mine_ai_prompts');
    return saved ? JSON.parse(saved) : [
      { id: '1', title: 'SSH 运维专家', content: '你是一个专业的 Linux 运维专家，擅长排查系统故障、优化性能和管理网络服务。请简明扼要地回答问题，并提供具体的命令操作。' },
      { id: '2', title: '代码解释器', content: '你是一个代码专家，请详细解释屏幕上出现的代码或命令的含义、潜在风险及改进建议。' },
      { id: '3', title: '日志分析员', content: '你擅长分析系统日志，请根据提供的日志片段找出错误原因并提出解决方案。' }
    ];
  });
  const [newPrompt, setNewPrompt] = useState({ title: '', content: '' });
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);

  useEffect(() => {
    localStorage.setItem('minessh_ai_prompts', JSON.stringify(prompts));
  }, [prompts]);
  
  useEffect(() => {
    localStorage.setItem('minessh_ai_config', JSON.stringify(config));
  }, [config]);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [autoRun, setAutoRun] = useState(true);
  const [executingCmd, setExecutingCmd] = useState(false);
  const cmdBufferRef = React.useRef('');
  const cmdEndMarkerRef = React.useRef('');
  const lastDataTimeRef = React.useRef(0);
  const requestIdRef = React.useRef(0);
  
  // Ref to hold the latest state-dependent logic
  const stateRef = React.useRef({
      config,
      autoRun,
      messages,
      finishCommandExecution: (output: string, timedOut?: boolean) => {} // Placeholder
  });

  // Update ref on every render
  useEffect(() => {
      stateRef.current = {
          config,
          autoRun,
          messages,
          finishCommandExecution // This function captures latest scope if defined below
      };
  });

  // Re-define these functions to rely on refs or be stable, 
  // but actually simpler is to make the SSH listener call a ref that points to latest logic.

  const handleStop = () => {
    requestIdRef.current++; // Invalidate pending requests
    setLoading(false);
    setExecutingCmd(false);
    setAutoRun(false);
    // Clear context to prevent loop
    // But we should keep the visible messages, just maybe add a system note that context is reset?
    // Actually, user says "new sentences have no effect, still thinking about previous question".
    // This implies the AI context window still has the old "ongoing task" instructions.
    // We need to append a system instruction to FORCE stop the current task.
    setMessages(prev => [...prev, { role: 'system', content: 'Task stopped by user. Forget previous pending tasks and wait for new instructions.' }]);
  };

  const handleFollowUp = async (output: string, timedOut = false) => {
     setLoading(true);
     const currentId = requestIdRef.current;
     
     try {
        const currentMessages = stateRef.current.messages;
        const currentConfig = stateRef.current.config;
        
        // Use the shared helper to ensure system prompt is included
        const contextMessages = prepareContextMessages(currentMessages);
        
        // Add the current output as context
        let userContent = `Command executed. Output:\n${output}\n\nPlease analyze the output. Is the original task fully completed and VERIFIED? \n- If NO: Provide the next command in <run> tags.\n- If YES: Provide a final summary.`;
        
        if (timedOut) {
            userContent += `\n\n[System Warning]: The command timed out and might be waiting for input. If so, provide ONLY the input value (e.g. <run>yes</run> or <run>2</run>) to interact with the running process.`;
        }

        contextMessages.push({ role: 'user', content: userContent });

        const response = await window.electronAPI.aiChat(
            contextMessages, 
            currentConfig.model, 
            currentConfig.baseUrl,
            currentConfig.provider,
            currentConfig.apiKey
        );
        
        if (currentId !== requestIdRef.current) return;

        if (response && response.message) {
            const aiContent = response.message.content;
            setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
            processAIResponse(aiContent);
        }
     } catch (error: any) {
         if (currentId !== requestIdRef.current) return;
         setMessages(prev => [...prev, { role: 'system', content: `Error: ${error.message}` }]);
     } finally {
         if (currentId === requestIdRef.current) {
            setLoading(false);
         }
     }
  };

  const finishCommandExecution = (output: string, timedOut = false) => {
    cmdEndMarkerRef.current = '';
    setExecutingCmd(false);
    setCurrentCmd(null);
    
    // Add observation to chat
    setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last.role === 'ai') {
            let content = `Output:\n${output}`;
            if (timedOut) {
                content += `\n\n[System Warning]: Output capture timed out (5s). The command might be interactive (waiting for input) or simply slow. If it's waiting for input (e.g. [y/n], selection number), please provide the input in <run> tags (e.g. <run>2</run> or <run>y</run>). DO NOT wrap the input in echo or pipe if the command is already running.`;
            }
            // Mark as hidden so it doesn't clutter UI but is available for context
            return [...prev, { role: 'system', content, hidden: true }];
        }
        return prev;
    });

    if (stateRef.current.autoRun) {
        handleFollowUp(output, timedOut);
    }
  };

  // The persistent listener that delegates to the latest logic
  useEffect(() => {
    if (!activeSessionId) return;

    const handleData = (_: any, { id, data }: { id: string; data: string }) => {
      if (id === activeSessionId && cmdEndMarkerRef.current) {
        cmdBufferRef.current += data;
        lastDataTimeRef.current = Date.now();
        
        // Check for shell prompt at the end of buffer
        // Common prompts: ends with $, #, %, >, or ➜, usually preceded by space or bracket
        // We match the last line ending with a prompt character
        // Regex Explanation:
        // (?:\r\n|\n|^) -> Start of line (or buffer start)
        // .* -> Any content on that line
        // [#$%>➜] -> The prompt character
        // \s* -> Optional trailing whitespace
        // $ -> End of buffer
        const promptRegex = /(?:\r\n|\n|^).*?[#$%>➜]\s*$/;
        
        if (promptRegex.test(cmdBufferRef.current)) {
           // Command finished
           const output = cmdBufferRef.current.trim();
           stateRef.current.finishCommandExecution(output);
        }
      }
    };

    const cleanup = window.electronAPI.onSSHData(handleData);
    return () => cleanup();
  }, [activeSessionId]);

  const renderMessageContent = (content: string) => {
    // Regex to split content by <run> tags
    // We want to capture the content inside run tags
    // Note: This simple split might be tricky if there are multiple tags or nested (though nested shouldn't happen)
    
    // Pattern to match <run>...</run> OR <write_file ...>...</write_file>
    const regex = /(<run>[\s\S]*?<\/run>|<write_file\s+path="[^"]+">[\s\S]*?<\/write_file>)/g;
    
    const parts: { type: 'text' | 'command' | 'file'; content: string; path?: string }[] = [];
    let lastIndex = 0;
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
      }
      
      const fullMatch = match[0];
      if (fullMatch.startsWith('<run>')) {
        const cmd = fullMatch.replace('<run>', '').replace('</run>', '').trim();
        parts.push({ type: 'command', content: cmd });
      } else if (fullMatch.startsWith('<write_file')) {
        const pathMatch = fullMatch.match(/path="([^"]+)"/);
        const path = pathMatch ? pathMatch[1] : 'unknown';
        const fileContent = fullMatch.replace(/<write_file[^>]*>/, '').replace('</write_file>', '').trim();
        parts.push({ type: 'file', path, content: fileContent });
      }
      
      lastIndex = match.index + fullMatch.length;
    }
    
    // Remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) });
    }
    
    if (parts.length === 0) {
      return <p className="whitespace-pre-wrap break-words">{content}</p>;
    }
  
    return (
      <div className="space-y-3">
        {parts.map((part, i) => {
          if (part.type === 'text') {
             if (!part.content.trim()) return null;
             return <p key={i} className="whitespace-pre-wrap break-words">{part.content}</p>;
          }
          if (part.type === 'command') {
            return (
              <div key={i} className="bg-black/30 rounded-lg overflow-hidden border border-white/10 my-2">
                 <div className="bg-white/5 px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-blue-300">Command</span>
                 </div>
                 <div className="p-3 font-mono text-xs text-blue-100 whitespace-pre-wrap break-all bg-black/20">
                   {part.content || <span className="text-gray-500 italic">(Enter)</span>}
                 </div>
              </div>
            );
          }
          if (part.type === 'file') {
               return (
              <div key={i} className="bg-black/30 rounded-lg overflow-hidden border border-white/10 my-2">
                 <div className="bg-white/5 px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-green-300">Write File</span>
                    <span className="text-[10px] text-gray-400 font-mono">{part.path}</span>
                 </div>
                 <div className="p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all bg-black/20 max-h-40 overflow-y-auto custom-scrollbar">
                   {part.content}
                 </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };


  useEffect(() => {
    // Fetch available models when config opens or component mounts
    // Only fetch if base url is set
    if (config.baseUrl) fetchModels();
  }, [config.baseUrl, config.provider, config.apiKey]);

  const fetchModels = async () => {
    try {
      const result = await window.electronAPI.getAIModels(config.baseUrl, config.provider, config.apiKey);
      if (result && result.models) {
        setAvailableModels(result.models.map((m: any) => m.name));
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      // Don't clear models on error, just keep existing
    }
  };

  const processAIResponse = (content: string) => {
    // 1. Check for file write pattern: <write_file path="..."> content </write_file>
    const writeFileRegex = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/;
    const writeMatch = content.match(writeFileRegex);
    
    if (writeMatch && activeSessionId) {
        const path = writeMatch[1].trim();
        const fileContent = writeMatch[2].trim(); // Trim might remove intentional newlines at start/end, but usually fine for configs
        // Better: don't trim internal content excessively, just ends
        
        if (path && fileContent !== undefined) {
             handleWriteFile(path, fileContent);
             return;
        }
    }

    // 2. Check for command pattern: <run> cmd </run>
    // Support multiple formats for robustness
    const patterns = [
        /<run>([\s\S]*?)<\/run>/,
        /@@@COMMAND@@@([\s\S]*?)@@@END@@@/,
        /```bash\s*([\s\S]*?)\s*```/
    ];

    for (const regex of patterns) {
        const match = content.match(regex);
        if (match && activeSessionId) {
            // We use the captured group, but we don't strictly require it to be non-empty
            // If it is empty/whitespace, it means "Send Enter"
            const cmd = match[1]; // Don't trim immediately, preserve whitespace if needed? 
            // Actually, for SSH commands, leading/trailing whitespace usually doesn't matter unless it's strictly inside quotes.
            // But for "Enter", we want to support empty string.
            // Let's trim for safety but allow empty result.
            
            const trimmedCmd = cmd.trim();
            
            // Allow empty command if it matches <run></run> or similar
            // This enables sending just "Enter" key
            executeCommand(trimmedCmd);
            return; // Execute only the first valid command found
        }
    }
  };

  const handleWriteFile = (path: string, content: string) => {
      if (!activeSessionId) return;
      
      setExecutingCmd(true);
      setCurrentCmd(`Writing file: ${path}`);
      
      // Use Base64 to safely write file content avoiding escaping issues
      // Handle UTF-8 characters correctly
      const base64Content = window.btoa(unescape(encodeURIComponent(content)));
      
      // Use pending marker to enable data collection (relies on prompt detection)
      cmdEndMarkerRef.current = 'PENDING';
      cmdBufferRef.current = ''; 
      lastDataTimeRef.current = Date.now();
      
      // Construct command: echo "BASE64" | base64 -d > path
      // We also verify the write with ls -l
      const cmd = `echo "${base64Content}" | base64 -d > "${path}" && echo "File written to ${path}"`;
      
      window.electronAPI.sendSSHInput(activeSessionId, `${cmd}\n`);
  };

  const executeCommand = (cmd: string) => {
      if (!activeSessionId) return;
      
      setExecutingCmd(true);
      setCurrentCmd(cmd || '(Sending Enter)');
      // Use a flag to indicate we are waiting for command completion
      cmdEndMarkerRef.current = 'PENDING'; 
      cmdBufferRef.current = ''; // Reset buffer
      lastDataTimeRef.current = Date.now();

      // Send command directly without wrapping
      // This avoids syntax errors in some shells/environments
      window.electronAPI.sendSSHInput(activeSessionId, `${cmd}\n`);
  };

  // Monitor for execution timeout (silence detection)
  // If no data received for 5 seconds, assume command is blocking/interactive or finished without prompt
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (executingCmd) {
        interval = setInterval(() => {
            if (Date.now() - lastDataTimeRef.current > 5000) {
                 // Timeout - stop waiting
                 // We append a note to the output so the AI knows it timed out
                 const currentOutput = cmdBufferRef.current;
                 // Don't modify output, just finish with timeout flag
                 stateRef.current.finishCommandExecution(currentOutput, true);
            }
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [executingCmd]);

  const handleAddPrompt = () => {
    if (!newPrompt.title.trim() || !newPrompt.content.trim()) return;
    setPrompts([...prompts, {
      id: Date.now().toString(),
      title: newPrompt.title,
      content: newPrompt.content
    }]);
    setNewPrompt({ title: '', content: '' });
    setIsAddingPrompt(false);
  };

  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrompts(prompts.filter(p => p.id !== id));
  };

  const handleSelectPrompt = (prompt: Prompt) => {
    setActivePromptId(prompt.id);
    setShowPrompts(false);
    
    // Add a system message to chat to indicate role switch
    setMessages(prev => [...prev, { role: 'system', content: `已切换角色为: ${prompt.title}` }]);
  };

  const CORE_SYSTEM_INSTRUCTION = `
    SSH Server Control Execution Guide

    EXECUTION GOAL:
    Complete the user's request fully and verify the result.

    EXECUTION RULES:
    1. COMMAND EXECUTION:
      - Wrap commands in <run> tags:
        <run>
        command
        </run>

    2. FILE OPERATIONS:
      - Use <write_file> tags to create or edit files (safer than echo/sed):
        <write_file path="/file/path">
        file content
        </write_file>

    3. EXECUTION LIMITS:
      - Execute only ONE action (command or file write) at a time
      - Non-interactive commands only (no top, vim, nano, etc.)

    INTERACTIVE COMMAND HANDLING:
    If a command becomes interactive (prompts like "Selection number:", "Password:", "[y/n]"):
    1. The system may timeout
    2. Correct method: Send input directly using <run> tags:
      <run>2</run>
      <run>yes</run>
      <run>password123</run>
      <run></run> (Use empty tag to send Enter key only)
    3. Do NOT use 'echo' or pipes for already running interactive commands

    CORE EXECUTION PRINCIPLES:
    CONTINUOUS EXECUTION:
    - After each command output, you will be prompted for the next step
    - Do NOT stop until the task is fully complete

    VERIFICATION (MUST DO):
    - After file operations: Check if file exists and verify content
    - After service changes: Check service status
    - After configuration changes: Verify the changes took effect

    ERROR HANDLING:
    - If a command fails: Analyze the error and try a different approach
    - Log critical errors for debugging

    TASK COMPLETION:
    - When task is done: Output a final summary (without <run> tags)
    - Ensure all verifications pass

    BEST PRACTICES:
    1. Plan first: Understand requirements before executing
    2. Verify incrementally: Verify immediately after each operation
    3. Log actions: Record important execution steps
    4. Safety first: Confirm impact scope before sensitive operations
      
  `;

  const prepareContextMessages = (currentMessages: typeof messages) => {
      const contextMessages = currentMessages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role === 'system' ? 'user' : 'user',
        content: m.content
      }));
      
      // Get active prompt content
      const activePrompt = prompts.find(p => p.id === activePromptId);
      const userSystemPrompt = activePrompt ? activePrompt.content : '';

      const fullSystemPrompt = `You are a helpful SSH assistant. ${userSystemPrompt}
      
      ${CORE_SYSTEM_INSTRUCTION}`;
      
      // Always ensure system prompt is at the start
      if (contextMessages.length === 0 || contextMessages[0].role !== 'system') {
          contextMessages.unshift({ role: 'system', content: fullSystemPrompt });
      } else {
          contextMessages[0].content = fullSystemPrompt;
      }
      
      return contextMessages;
  };

  const sendMessageToAI = async (messageContent: string) => {
    try {
      const contextMessages = prepareContextMessages(messages);
      contextMessages.push({ role: 'user', content: messageContent });

      const response = await window.electronAPI.aiChat(
          contextMessages, 
          config.model, 
          config.baseUrl,
          config.provider,
          config.apiKey
      );
      
      if (response && response.message) {
         const aiContent = response.message.content;
         setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
         processAIResponse(aiContent);
      } else {
         setMessages(prev => [...prev, { role: 'ai', content: 'Error: No response from AI.' }]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    await sendMessageToAI(userMessage);
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-200 relative">
      {/* Header - No border, floating elements handled by global title bar */}
      
      {/* Prompts Overlay */}
      {showPrompts && (
        <div className="absolute top-0 left-0 right-0 bottom-[70px] bg-zinc-900/95 backdrop-blur-xl z-20 flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Book className="w-4 h-4 text-blue-400" />
                    角色库
                </h3>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsAddingPrompt(true)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="添加角色"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setShowPrompts(false)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isAddingPrompt && (
                    <div className="bg-black/40 border border-blue-500/30 rounded-xl p-4 mb-4 space-y-3">
                        <input
                            type="text"
                            placeholder="角色名称"
                            value={newPrompt.title}
                            onChange={(e) => setNewPrompt({...newPrompt, title: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none"
                        />
                        <textarea
                            placeholder="角色设定 (System Prompt)"
                            value={newPrompt.content}
                            onChange={(e) => setNewPrompt({...newPrompt, content: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none min-h-[80px]"
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setIsAddingPrompt(false)}
                                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleAddPrompt}
                                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                )}
                
                {prompts.map(prompt => (
                    <div 
                        key={prompt.id}
                        onClick={() => handleSelectPrompt(prompt)}
                        className={`
                            group border rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.02]
                            ${activePromptId === prompt.id 
                                ? 'bg-blue-600/20 border-blue-500/50' 
                                : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10'}
                        `}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <h4 className={`font-medium text-sm transition-colors ${activePromptId === prompt.id ? 'text-blue-400' : 'text-gray-200 group-hover:text-blue-400'}`}>
                                {prompt.title}
                                {activePromptId === prompt.id && <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">当前</span>}
                            </h4>
                            <button 
                                onClick={(e) => handleDeletePrompt(prompt.id, e)}
                                className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{prompt.content}</p>
                    </div>
                ))}
                
                {prompts.length === 0 && !isAddingPrompt && (
                    <div className="text-center text-gray-500 text-sm py-8">
                        暂无角色，请点击 + 添加。
                    </div>
                )}
            </div>
        </div>
      )}
      
      {/* Config Overlay - Adjusted top position */}
      {showConfig && (
        <div className="absolute top-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl p-4 border-b border-white/10 z-20 shadow-2xl">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">API 提供商 (Provider)</label>
                    <select 
                        value={config.provider}
                        onChange={(e) => {
                            const newProvider = e.target.value as any;
                            let newConfig = { ...config, provider: newProvider };
                            // Auto-fill defaults for convenience
                            if (newProvider === 'deepseek') {
                                if (!config.baseUrl || config.baseUrl.includes('localhost') || config.baseUrl.includes('openai')) {
                                    newConfig.baseUrl = 'https://api.deepseek.com';
                                }
                                if (!config.model || config.model === 'llama3') {
                                    newConfig.model = 'deepseek-chat';
                                }
                            } else if (newProvider === 'openai') {
                                if (config.baseUrl.includes('localhost') || config.baseUrl.includes('deepseek')) {
                                    newConfig.baseUrl = 'https://api.openai.com/v1';
                                }
                            }
                            setConfig(newConfig);
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none text-gray-200"
                    >
                        <option value="ollama">Ollama (本地)</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="openai">OpenAI Compatible</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">API 地址 (URL)</label>
                    <input 
                        type="text" 
                        value={config.baseUrl}
                        onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                    />
                </div>

                {config.provider !== 'ollama' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">API Key</label>
                        <input 
                            type="password" 
                            value={config.apiKey || ''}
                            onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                            placeholder="sk-..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">模型名称 (Model)</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={config.model}
                            onChange={(e) => setConfig({...config, model: e.target.value})}
                            list="model-suggestions"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                            placeholder="例如: llama3, mistral"
                        />
                        <datalist id="model-suggestions">
                            {availableModels.map(m => <option key={m} value={m} />)}
                            {!availableModels.includes('llama3') && <option value="llama3" />}
                            {!availableModels.includes('mistral') && <option value="mistral" />}
                            {!availableModels.includes('codellama') && <option value="codellama" />}
                        </datalist>
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                    <button onClick={fetchModels} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">刷新模型列表</button>
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="autorun" 
                            checked={autoRun} 
                            onChange={(e) => setAutoRun(e.target.checked)}
                            className="rounded bg-black/40 border-white/20 text-blue-500 focus:ring-offset-0 focus:ring-blue-500/50"
                        />
                        <label htmlFor="autorun" className="text-xs text-gray-400 cursor-pointer select-none">自动运行命令</label>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.filter(m => !m.hidden).map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
                className={`
                    max-w-[90%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : msg.role === 'system'
                        ? 'bg-red-500/10 text-red-200 border border-red-500/20 font-mono text-xs'
                        : 'bg-white/10 text-gray-200 rounded-bl-none backdrop-blur-sm'}
                `}
            >
              {msg.role === 'ai' 
                  ? renderMessageContent(msg.content)
                  : <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              }
            </div>
          </div>
        ))}
        {loading && (
             <div className="flex justify-start">
                <div className="bg-white/5 rounded-2xl rounded-bl-none p-4">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Command Status Bar */}
      {currentCmd && (
          <div className="px-4 py-2 bg-blue-500/10 border-t border-b border-blue-500/20 backdrop-blur-sm flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-blue-300 uppercase tracking-wider mb-0.5">Executing Command</div>
                  <div className="text-xs text-blue-100 font-mono truncate" title={currentCmd}>{currentCmd}</div>
              </div>
          </div>
      )}

      <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
        <div className="relative group flex gap-2">
          <button
            onClick={() => setShowPrompts(!showPrompts)}
            className={`
                p-3 rounded-xl border transition-all flex items-center justify-center
                ${showPrompts 
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}
            `}
            title="Prompt Library"
          >
            <Book className="w-4 h-4" />
          </button>
          
          <div className="relative flex-1 min-w-0">
            <input
                type="text"
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={loading ? "AI 正在思考..." : "输入消息..."}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/60 transition-all disabled:opacity-50"
            />
            <button 
                onClick={loading ? handleStop : handleSend}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    loading 
                    ? 'text-red-400 hover:text-white hover:bg-red-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
            >
                {loading ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
