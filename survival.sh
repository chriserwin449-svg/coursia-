#!/bin/bash
# Coursia - Launch server in tight loop
cd /home/z/my-project
while true; do
  node server.js
  sleep 0.5
done
