#!/bin/bash

echo "🌐 La Carta Public Access Setup"
echo "================================"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "📦 Installing ngrok..."
    if command -v brew &> /dev/null; then
        brew install ngrok/ngrok/ngrok
    else
        echo "Please install ngrok manually from: https://ngrok.com/download"
        exit 1
    fi
fi

echo "🔧 Starting ngrok tunnels..."
echo ""
echo "This will create public URLs for your app."
echo ""

# Create ngrok config for both services
cat > ngrok-config.yml << EOF
version: "2"
tunnels:
  frontend:
    proto: http
    addr: 3000
    inspect: false
  backend:
    proto: http
    addr: 3001
    inspect: false
EOF

echo "Starting tunnels..."
echo ""
echo "📱 Your public URLs will appear below:"
echo "Share these with your friends!"
echo ""
echo "Press Ctrl+C to stop sharing"
echo "================================"
echo ""

# Start ngrok with both tunnels
ngrok start --all --config ngrok-config.yml