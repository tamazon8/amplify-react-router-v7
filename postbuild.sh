#!/bin/bash
set -e

# 出力ディレクトリの準備
echo "Creating .amplify-hosting directory structure..."
mkdir -p .amplify-hosting/compute/default
mkdir -p .amplify-hosting/static

# サーバーファイルのコピー
echo "Copying server files..."
cp -r build/server/* .amplify-hosting/compute/default/

# package.jsonをサーバーディレクトリにコピー
echo "Copying package.json to server..."
cp package.json .amplify-hosting/compute/default/

# Expressを依存関係に追加
echo "Adding Express dependency..."
cd .amplify-hosting/compute/default
npm install express --save
cd -

# 依存関係のコピー
echo "Copying node_modules to server..."
cp -r node_modules .amplify-hosting/compute/default/

# package-lock.jsonもコピー
if [ -f "package-lock.json" ]; then
  echo "Copying package-lock.json to server..."
  cp package-lock.json .amplify-hosting/compute/default/
fi

# クライアントファイルのコピー
echo "Copying client files..."
cp -r build/client/* .amplify-hosting/static/

# deploy-manifest.jsonの作成
echo "Creating deploy-manifest.json..."
cat > .amplify-hosting/deploy-manifest.json << 'EOL'
{
  "version": 1,
  "routes": [
    {
      "path": "/*.*",
      "target": {
        "kind": "Static"
      },
      "fallback": {
        "kind": "Compute",
        "src": "default"
      }
    },
    {
      "path": "/*",
      "target": {
        "kind": "Compute",
        "src": "default"
      }
    }
  ],
  "computeResources": [
    {
      "name": "default",
      "entrypoint": "server.js",
      "runtime": "nodejs20.x"
    }
  ],
  "framework": {
    "name": "react-router",
    "version": "7.5.1"
  }
}
EOL

echo "Post-build process completed successfully!"

# 検証スクリプトを実行
echo "Running verification..."
chmod +x ./verify-deploy.sh
./verify-deploy.sh
