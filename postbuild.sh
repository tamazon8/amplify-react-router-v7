#!/bin/bash
set -e

# 出力ディレクトリの準備
echo "Creating .amplify-hosting directory structure..."
mkdir -p .amplify-hosting/compute/default
mkdir -p .amplify-hosting/static

# サーバーファイルのコピー
echo "Copying server files..."
cp -r build/server/* .amplify-hosting/compute/default/

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
      "entrypoint": "index.js",
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
