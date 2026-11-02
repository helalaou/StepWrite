#!/bin/bash

clear

# Stop the processes listening on the given ports. Only listeners: a plain
# 'lsof -i:PORT' also lists every client connected to the port, such as a
# browser tab with the app open.
kill_ports() {
    local ports=("$@")
    for port in "${ports[@]}"; do
        echo "Checking for processes listening on port $port..."
        pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN)
        if [ -n "$pids" ]; then
            echo "Stopping process(es) $(echo $pids) on port $port..."
            kill $pids
        else
            echo "No process listening on port $port."
        fi
    done
}

stop_servers() {
    echo "Stopping servers..."
    kill_ports 3000 3001
    echo "All components stopped."
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

# Stop the servers when the script exits, whether through ENTER or Ctrl-C
trap stop_servers EXIT

read -p "Press [ENTER] to stop the servers..."
