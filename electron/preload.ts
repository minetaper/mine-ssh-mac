import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  connectSSH: (config: any) => ipcRenderer.invoke('ssh-connect', config),
  disconnectSSH: (id: string) => ipcRenderer.send('ssh-disconnect', { id }),
  sendSSHInput: (id: string, data: string) => ipcRenderer.send('ssh-input', { id, data }),
  resizeSSH: (id: string, rows: number, cols: number) => ipcRenderer.send('ssh-resize', { id, rows, cols }),
  onSSHData: (callback: (event: any, data: { id: string, data: string }) => void) => {
    ipcRenderer.on('ssh-data', callback);
    return () => {
      ipcRenderer.removeListener('ssh-data', callback);
    };
  },
  onSSHClosed: (callback: (event: any, data: { id: string }) => void) => {
    ipcRenderer.on('ssh-closed', callback);
    return () => {
      ipcRenderer.removeListener('ssh-closed', callback);
    };
  },
  aiChat: (messages: any[], model: string, baseUrl: string, provider?: string, apiKey?: string) => ipcRenderer.invoke('ai-chat', { messages, model, baseUrl, provider, apiKey }),
  getAIModels: (baseUrl: string, provider?: string, apiKey?: string) => ipcRenderer.invoke('ai-models', { baseUrl, provider, apiKey }),
})
