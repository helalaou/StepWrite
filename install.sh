#!/bin/bash

echo "Installing dependencies for the client and server..."

# Install client dependencies
if [ -d "client" ]; then
    echo "Installing client dependencies..."
    cd client || exit
    npm install
    cd ..
else
    echo "Client directory not found! Skipping client installation."
fi

# Install server dependencies
if [ -d "server" ]; then
    echo "Installing server dependencies..."
    cd server || exit
    npm install express cors dotenv openai
    cd ..
else
    echo "Server directory not found! Skipping server installation."
fi

echo "Installation completed."
