#!/bin/bash

echo "🚀 La Carta - Share with Friends"
echo "================================="
echo ""

# Start frontend tunnel in background
echo "Starting frontend tunnel..."
ngrok http 3000 --log=stdout > frontend-url.txt 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Start backend tunnel in background  
echo "Starting backend tunnel..."
ngrok http 3001 --log=stdout > backend-url.txt 2>&1 &
BACKEND_PID=$!

# Wait for tunnels to establish
sleep 3

# Extract URLs
FRONTEND_URL=$(grep -o 'https://[a-z0-9]*.ngrok-free.app' frontend-url.txt | head -1)
BACKEND_URL=$(grep -o 'https://[a-z0-9]*.ngrok-free.app' backend-url.txt | head -1)

# If URLs aren't found, use ngrok's free tier format
if [ -z "$FRONTEND_URL" ]; then
    echo "Setting up tunnels (this may take a moment)..."
    # Kill existing processes
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    
    # Use ngrok's simpler approach
    echo ""
    echo "📱 Quick Setup Instructions:"
    echo ""
    echo "Open 2 terminal tabs and run:"
    echo ""
    echo "Tab 1: ngrok http 3000"
    echo "Tab 2: ngrok http 3001"
    echo ""
    echo "Then share the URLs with your friends!"
else
    clear
    echo "🎉 La Carta is now PUBLIC!"
    echo "=========================="
    echo ""
    echo "Share these URLs with your friends:"
    echo ""
    echo "📱 Frontend App: $FRONTEND_URL"
    echo "🔧 Backend API: $BACKEND_URL"
    echo ""
    echo "Your friends can access from anywhere!"
    echo ""
    echo "Press Ctrl+C to stop sharing"
    
    # Keep running
    wait
fi