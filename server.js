// server.js - AWS Amplify Hosting用のExpressサーバー
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createRequestHandler } from '@react-router/express';
import * as serverBuild from './index.js';

// ディレクトリ設定
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, '../static')));

// React Router v7のリクエストハンドラー
// エクスポートされているindexからbuildパラメータとして渡します
app.all('*', createRequestHandler({
  build: serverBuild,
  // React Router v7の設定に基づいた最小限のモード設定
  mode: serverBuild.isSpaMode ? "spa" : "ssr"
}));

// エラー処理
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// AWS Lambda ハンドラ
export const handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event));
  
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
      
      // Expressリクエスト
      const req = {
        method: event.httpMethod || 'GET',
        url: path + queryString,
        headers: event.headers || {},
        body: event.body,
        connection: {},
      };
      
      // Expressレスポンス
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

// ローカル開発用サーバー起動 (Lambda環境では呼ばれない)
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app; 