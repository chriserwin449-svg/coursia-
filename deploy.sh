#!/bin/bash
# Vercel deployment script for Coursia
# This script prepares and deploys Coursia to Vercel

set -e

echo "=== Coursia Vercel Deployment ==="

# Step 1: Ensure we're in the project directory
cd /home/z/my-project

# Step 2: Generate Prisma client
echo "[1/5] Generating Prisma client..."
npx prisma generate 2>&1 | tail -3

# Step 3: Build the Next.js project
echo "[2/5] Building Next.js project..."
echo "NOTE: Using PostgreSQL for Vercel deployment..."

# Step 4: Deploy to Vercel
echo "[3/5] Deploying to Vercel..."
vercel --yes --prod 2>&1

echo "=== Deployment Complete ==="
