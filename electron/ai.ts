import { ipcMain, net } from 'electron';

export const setupAIHandler = () => {
  ipcMain.handle('ai-chat', async (_, { messages, model, baseUrl, provider, apiKey }) => {
    return new Promise((resolve, reject) => {
      const isOpenAI = provider === 'openai' || provider === 'deepseek';
      // Ensure baseUrl doesn't have trailing slash
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      const url = isOpenAI 
        ? `${cleanBaseUrl}/chat/completions`
        : `${cleanBaseUrl}/api/chat`;

      const request = net.request({
        method: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
      });

      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk.toString();
        });
        
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`AI API Error: ${response.statusCode} - ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            
            // Normalize response to Ollama format: { message: { content: ... } }
            if (isOpenAI) {
                // OpenAI format: { choices: [ { message: { content: ... } } ] }
                if (json.choices && json.choices.length > 0) {
                    resolve({ message: json.choices[0].message });
                } else {
                    reject(new Error('Invalid OpenAI response format'));
                }
            } else {
                // Ollama format
                resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      const payload = JSON.stringify({
        model: model || (isOpenAI ? 'deepseek-chat' : 'llama3'),
        messages,
        stream: false, 
      });

      request.write(payload);
      request.end();
    });
  });

  ipcMain.handle('ai-models', async (_, { baseUrl, provider, apiKey }) => {
    return new Promise((resolve, reject) => {
      const isOpenAI = provider === 'openai' || provider === 'deepseek';
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      const url = isOpenAI 
        ? `${cleanBaseUrl}/models` // OpenAI/DeepSeek models endpoint
        : `${cleanBaseUrl}/api/tags`;

      const request = net.request({
        method: 'GET',
        url,
        headers: {
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        }
      });

      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk.toString();
        });
        
        response.on('end', () => {
          if (response.statusCode !== 200) {
            // For OpenAI/DeepSeek, if models endpoint fails, we might just return default list or error
            // But let's reject for now to let frontend handle it
            reject(new Error(`AI API Error: ${response.statusCode}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            
            if (isOpenAI) {
                // OpenAI: { data: [ { id: "..." } ] }
                // Normalize to Ollama: { models: [ { name: "..." } ] }
                if (json.data) {
                    resolve({ models: json.data.map((m: any) => ({ name: m.id })) });
                } else {
                    resolve({ models: [] });
                }
            } else {
                resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.end();
    });
  });
};
