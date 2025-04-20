#!/bin/bash
set -e

echo "Verifying deployment structure..."

# .amplify-hosting ディレクトリが存在するか確認
if [ ! -d ".amplify-hosting" ]; then
  echo "ERROR: .amplify-hosting directory does not exist!"
  exit 1
fi

# compute/default ディレクトリが存在するか確認
if [ ! -d ".amplify-hosting/compute/default" ]; then
  echo "ERROR: .amplify-hosting/compute/default directory does not exist!"
  exit 1
fi

# static ディレクトリが存在するか確認
if [ ! -d ".amplify-hosting/static" ]; then
  echo "ERROR: .amplify-hosting/static directory does not exist!"
  exit 1
fi

# サーバーファイルがコピーされているか確認
if [ ! -f ".amplify-hosting/compute/default/index.js" ]; then
  echo "ERROR: Server file index.js not found in .amplify-hosting/compute/default!"
  
  # build/server ディレクトリの内容を確認
  echo "Checking build/server directory content:"
  ls -la build/server/
  
  echo "Attempting to manually copy server files..."
  mkdir -p .amplify-hosting/compute/default
  cp -r build/server/* .amplify-hosting/compute/default/
fi

# deploy-manifest.json が存在するか確認
if [ ! -f ".amplify-hosting/deploy-manifest.json" ]; then
  echo "ERROR: deploy-manifest.json not found in .amplify-hosting!"
  exit 1
fi

echo "Deployment structure verification complete."
echo "Contents of .amplify-hosting/compute/default:"
ls -la .amplify-hosting/compute/default/

echo "Contents of .amplify-hosting/static:"
ls -la .amplify-hosting/static/ | head -n 10

echo "Content of deploy-manifest.json:"
cat .amplify-hosting/deploy-manifest.json 