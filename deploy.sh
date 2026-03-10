#!/bin/bash
echo "Building frontend..."
npm run build
echo "Uploading to server..."
rsync -avz --delete dist/ deploy@YOUR_SERVER_IP:~/hoarder_frontend/
echo "✅ Frontend deployed!"