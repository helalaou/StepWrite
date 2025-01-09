#!/bin/bash

echo "Starting deployment process..."

echo "Running installation script..."
chmod +x install.sh
./install.sh

if [ $? -eq 0 ]; then
    echo "Installation completed successfully."
    
    echo "Starting the application..."
    chmod +x run.sh
    ./run.sh
else
    echo "Installation failed. Please check the errors above."
    exit 1
fi 