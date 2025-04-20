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

# deploy-manifest.jsonのコピー
echo "Copying deploy-manifest.json..."
cp deploy-manifest.json .amplify-hosting/

echo "Post-build process completed successfully!" 