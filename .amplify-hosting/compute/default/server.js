// server.js - Express サーバーを起動するためのエントリーポイント
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { PassThrough } from 'node:stream';
import * as indexHandler from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 静的ファイルのサービング
app.use(express.static(path.join(__dirname, '../static')));

// すべてのリクエストをSSRハンドラにルーティング
app.get('*', async (req, res) => {
  try {
    console.log(`Handling request: ${req.url}`);
    
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

    // SSR処理
    const routerContext = {
      url: req.url,
      isSpaMode: false
    };
    
    try {
      // SSRハンドラー関数を呼び出し
      const result = await indexHandler.default(
        request,
        200,
        new Headers(),
        routerContext,
        {}
      );
      
      // ステータスコードとヘッダーの設定
      res.status(result.status || 200);
      
      if (result.headers) {
        result.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
      }
      
      // レスポンスボディの処理
      if (result.body) {
        const chunks = [];
        const reader = result.body.getReader();
        
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            chunks.push(value);
          }
        }
        
        const buffer = Buffer.concat(chunks);
        res.end(buffer);
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Error in SSR handler:', error);
      res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// エラー処理
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send('Internal Server Error');
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
