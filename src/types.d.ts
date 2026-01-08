export interface IElectronAPI {
  connectSSH: (config: any) => Promise<{ id: string; status: string }>;
  disconnectSSH: (id: string) => void;
  sendSSHInput: (id: string, data: string) => void;
  resizeSSH: (id: string, rows: number, cols: number) => void;
  onSSHData: (callback: (event: any, data: { id: string, data: string }) => void) => () => void;
  onSSHClosed: (callback: (event: any, data: { id: string }) => void) => () => void;
  aiChat: (messages: any[], model: string, baseUrl: string, provider?: string, apiKey?: string) => Promise<any>;
  getAIModels: (baseUrl: string, provider?: string, apiKey?: string) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
