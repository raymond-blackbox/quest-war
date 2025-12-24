# Deploy Script for Quest War
# Usage: .\deploy.ps1
# Prerequisites: gcloud CLI, firebase CLI

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "quest-war" # Replace with your actual Project ID if different
$REGION = "asia-southeast1"
$SERVICE_NAME = "quest-war-backend"
$REPO_NAME = "quest-war-repo" # Create this in Artifact Registry first

Write-Host ">>> Starting Deployment for $PROJECT_ID..." -ForegroundColor Green

# 2. Frontend Deployment
Write-Host "`n>>> [Frontend] Building and Deploying to Firebase Hosting..." -ForegroundColor Cyan

# Build
Push-Location frontend
try {
    Write-Host "Building React App..."
    npm ci
    npm run build
} finally {
    Pop-Location
}

# Deploy (from root)
Write-Host "Setting active Firebase project to $PROJECT_ID..."
firebase use $PROJECT_ID

Write-Host "Deploying to Firebase..."
firebase deploy --only hosting

Write-Host "`n>>> Deployment Complete! Check your Firebase URL." -ForegroundColor Green
