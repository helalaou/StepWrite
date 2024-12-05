#!/bin/bash

clear

# Function to kill processes running on specified ports
kill_ports() {
    local ports=("$@")
    for port in "${ports[@]}"; do
        echo "Checking for processes running on port $port..."
        pid=$(lsof -t -i:$port)
        if [ -n "$pid" ]; then
            echo "Killing process $pid on port $port..."
            kill -9 $pid
        else
            echo "No process running on port $port."
        fi
    done
}

# Kill processes running on ports 3000 and 3001
kill_ports 3000 3001

# Start the Node.js server
if [ -d "server" ]; then
    echo "Starting Node.js server..."
    cd server || exit
    npm start &
    cd ..
else
    echo "Server directory not found! Skipping server start."
fi

echo "Waiting for servers to start..."
sleep 5

# Start the React app
if [ -d "client" ]; then
    echo "Starting React app..."
    cd client || exit
    npm start &
    cd ..
else
    echo "Client directory not found! Skipping React app start."
fi

echo "All components are running!"
echo "Access the application at http://localhost:3000"

# Wait for the user to stop the servers
read -p "Press [ENTER] to stop the servers..."

# Stop the servers
echo "Stopping servers..."
pkill -f "node server/server.js"
pkill -f "react-scripts start"

echo "All components stopped."
