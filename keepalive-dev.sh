#!/bin/bash
while true; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ > /dev/null 2>&1
  sleep 5
done
