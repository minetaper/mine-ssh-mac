import { Client } from 'ssh2';
import { ipcMain } from 'electron';

export class SSHManager {
  private connections: Map<string, Client> = new Map();

  constructor() {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('ssh-connect', async (_, config) => {
      return this.connect(config);
    });

    ipcMain.on('ssh-input', (_, { id, data }) => {
      const conn = this.connections.get(id);
      if (conn) {
        // @ts-ignore
        conn.stream.write(data);
      }
    });

    ipcMain.on('ssh-resize', (_, { id, rows, cols }) => {
      const conn = this.connections.get(id);
      if (conn) {
        // @ts-ignore
        conn.stream.setWindow(rows, cols, 0, 0);
      }
    });

    ipcMain.on('ssh-disconnect', (_, id) => {
      this.disconnect(id);
    });
  }

  private connect(config: any): Promise<{ id: string; status: string }> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const id = Math.random().toString(36).substring(7);

      conn.on('ready', () => {
        conn.shell((err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          // @ts-ignore
          conn.stream = stream;
          this.connections.set(id, conn);

          stream.on('close', () => {
            this.connections.delete(id);
            // Notify renderer about disconnection if needed
          });

          stream.on('data', (data: any) => {
             // Send data to renderer
             // We need a way to send back to the specific window/renderer
             // For now, let's assume we use webContents from the main process or similar
             // But since we are in a class, we might need to pass the webContents or use ipcMain to reply
             // However, ipcMain.handle is for request/response.
             // We should emit events to the renderer.
          });
          
          resolve({ id, status: 'connected' });
        });
      }).on('error', (err) => {
        reject(err);
      }).connect(config);
    });
  }

  private disconnect(id: string) {
    const conn = this.connections.get(id);
    if (conn) {
      conn.end();
      this.connections.delete(id);
    }
  }
  
  // Method to attach event listeners for data streaming
  public attachDataListener(webContents: Electron.WebContents) {
     this.connections.forEach((conn, id) => {
         // @ts-ignore
         if (conn.stream) {
             // @ts-ignore
             conn.stream.on('data', (data) => {
                 webContents.send('ssh-data', { id, data: data.toString() });
             });
         }
     });
     
     // Better approach: When connecting, pass the webContents or sender
  }
}

// Improved implementation with proper event handling
export const setupSSHHandler = (mainWindow: Electron.BrowserWindow) => {
    const connections = new Map<string, any>();

    ipcMain.handle('ssh-connect', async (event, config) => {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            const id = Math.random().toString(36).substring(7);

            conn.on('ready', () => {
                conn.shell((err, stream) => {
                    if (err) {
                        conn.end();
                        reject(err);
                        return;
                    }

                    connections.set(id, { conn, stream });

                    stream.on('close', () => {
                        connections.delete(id);
                        mainWindow.webContents.send('ssh-closed', { id });
                    });

                    stream.on('data', (data: any) => {
                        mainWindow.webContents.send('ssh-data', { id, data: data.toString() });
                    });

                    stream.stderr.on('data', (data: any) => {
                        mainWindow.webContents.send('ssh-data', { id, data: data.toString() });
                    });

                    resolve({ id, status: 'connected' });
                });
            });

            conn.on('error', (err) => {
                reject(err.message);
            });

            try {
                conn.connect(config);
            } catch (error: any) {
                reject(error.message);
            }
        });
    });

    ipcMain.on('ssh-input', (_, { id, data }) => {
        const session = connections.get(id);
        if (session && session.stream) {
            session.stream.write(data);
        }
    });

    ipcMain.on('ssh-resize', (_, { id, rows, cols }) => {
        const session = connections.get(id);
        if (session && session.stream) {
            session.stream.setWindow(rows, cols, 0, 0);
        }
    });

    ipcMain.on('ssh-disconnect', (_, { id }) => {
        const session = connections.get(id);
        if (session) {
            session.conn.end();
            connections.delete(id);
        }
    });
};
