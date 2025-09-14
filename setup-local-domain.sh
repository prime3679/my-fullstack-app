#!/bin/bash

# La Carta Local Domain Setup Script
# This script sets up user-friendly URLs for local development

echo "🍽️  La Carta Local Domain Setup"
echo "================================"
echo ""
echo "This script will add local domain entries to your /etc/hosts file."
echo "You'll need to enter your password to modify the hosts file."
echo ""

# Check if entries already exist
if grep -q "lacarta.local" /etc/hosts; then
    echo "✅ Local domains already configured!"
else
    echo "Adding local domain entries..."
    echo "" | sudo tee -a /etc/hosts > /dev/null
    echo "# La Carta Local Development" | sudo tee -a /etc/hosts > /dev/null
    echo "127.0.0.1    lacarta.local" | sudo tee -a /etc/hosts > /dev/null
    echo "127.0.0.1    api.lacarta.local" | sudo tee -a /etc/hosts > /dev/null
    echo ""
    echo "✅ Local domains configured successfully!"
fi

echo ""
echo "📱 Access your La Carta app at:"
echo "   Frontend: http://lacarta.local:3000"
echo "   Backend API: http://api.lacarta.local:3001"
echo ""
echo "🚀 To start the servers, run:"
echo "   npm run dev (from the root directory)"
echo ""
echo "Enjoy developing La Carta! 🎉"