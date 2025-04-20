// server.js - Express サーバーを起動するためのエントリーポイント
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { PassThrough } from 'node:stream';
import * as indexModule from './index.js';

// index.jsの内容をログに出力して調査
console.log('Index module exports:', Object.keys(indexModule));

// SSRハンドラを取得
// index.jsのhandleRequest関数は直接エクスポートされているか
// またはentryServer.defaultとしてエクスポートされている
let handleRequest = null;

if (indexModule.entryServer && indexModule.entryServer.default) {
  console.log('Using indexModule.entryServer.default as the SSR handler');
  handleRequest = indexModule.entryServer.default;
} else if (typeof indexModule.handleRequest === 'function') {
  console.log('Using indexModule.handleRequest as the SSR handler');
  handleRequest = indexModule.handleRequest;
} else {
  console.error('Could not find a valid handler function in index.js. Available exports:', 
              JSON.stringify(Object.keys(indexModule)));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 静的ファイルのサービング
app.use(express.static(path.join(__dirname, '../static')));

// リクエスト処理
app.get('*', async (req, res) => {
  try {
    console.log(`Handling request: ${req.url}`);
    
    // エクスポートされたハンドラ関数が見つからない場合、静的ファイルだけを提供
    if (!handleRequest) {
      console.log('No handler function found, serving static HTML instead');
      // 静的なHTMLを返す
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>React Router App</title>
          </head>
          <body>
            <div id="root">
              <h1>React Router App</h1>
              <p>This page is being served statically because the SSR handler could not be initialized properly.</p>
            </div>
            <script src="/assets/entry.client.js" type="module"></script>
          </body>
        </html>
      `);
    }
    
    // Express リクエストをRequest オブジェクトに変換
    const url = new URL(req.url, `http://${req.headers.host}`);
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value.toString());
    });
    
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
    });

    // React Routerのコンテキスト
    const routerContext = {
      url: req.url,
      isSpaMode: indexModule.isSpaMode || false
    };
    
    try {
      console.log('Calling SSR handler with request URL:', request.url);
      
      // SSRハンドラー関数の呼び出し
      const result = await handleRequest(
        request, 
        200, 
        new Headers(), 
        routerContext,
        {}
      );
      
      if (!result) {
        console.error('SSR handler returned no result');
        return res.status(500).send('Internal Server Error: SSR handler returned no result');
      }
      
      console.log('SSR handler returned result with status:', result.status);
      
      // ステータスコードとヘッダーの設定
      res.status(result.status || 200);
      
      if (result.headers) {
        result.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
      }
      
      // レスポンスボディの処理
      if (result.body) {
        if (result.body.getReader) {
          // ReadableStreamを処理
          const chunks = [];
          const reader = result.body.getReader();
          
          try {
            let done = false;
            while (!done) {
              const { value, done: doneReading } = await reader.read();
              done = doneReading;
              if (value) {
                chunks.push(value);
              }
            }
            
            const buffer = Buffer.concat(chunks);
            return res.end(buffer);
          } catch (streamError) {
            console.error('Error reading stream:', streamError);
            return res.status(500).send(`Error processing response stream: ${streamError.message}`);
          }
        } else if (typeof result.body === 'string') {
          // 文字列の場合
          return res.send(result.body);
        } else {
          // その他の形式
          return res.send(String(result.body));
        }
      } else {
        return res.end();
      }
    } catch (error) {
      console.error('Error in SSR handler:', error);
      return res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});

// エラー処理
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// AWS Lambda ハンドラ
export const lambdaHandler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event));
  
  // Lambda Proxy リクエストをExpressリクエストに変換するための簡易サーバー
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      console.log('Server is ready to handle requests');
      
      // リクエストパスの構築
      const path = event.path || '/';
      const queryString = event.queryStringParameters 
        ? '?' + Object.entries(event.queryStringParameters)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&')
        : '';
      
      // Express リクエスト
      const req = {
        method: event.httpMethod || 'GET',
        url: path + queryString,
        headers: event.headers || {},
        body: event.body,
        connection: {},
      };
      
      // Express レスポンス
      const res = {
        statusCode: 200,
        headers: {},
        body: '',
        setHeader: function(name, value) {
          this.headers[name] = value;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        write: function(chunk) {
          this.body += chunk.toString();
        },
        end: function(chunk) {
          if (chunk) this.body += chunk.toString();
          
          server.close(() => {
            console.log(`Response completed with status: ${this.statusCode}`);
            
            resolve({
              statusCode: this.statusCode,
              headers: this.headers,
              body: this.body,
              isBase64Encoded: false
            });
          });
        },
        send: function(body) {
          this.body = body;
          this.end();
        }
      };
      
      // リクエスト処理
      app(req, res);
    });
    
    // タイムアウト設定
    setTimeout(() => {
      server.close();
      reject(new Error('Server timeout'));
    }, 29000); // Lambda最大実行時間より少し短く
  });
};

// エクスポートをハンドラとして定義
export const handler = lambdaHandler;

// ローカル開発用サーバー起動 (Lambda環境では呼ばれない)
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`SSR server is running on port ${port}`);
  });
}

export default app;
