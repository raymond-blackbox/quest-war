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

# 1. Backend Deployment
Write-Host "`n>>> [Backend] Building and Deploying to Cloud Run..." -ForegroundColor Cyan

# Check if Artifact Registry repo exists (optional check, straightforward deployment)
# Using 'gcloud run deploy --source' builds with Cloud Build automatically
Write-Host "Deploying from source..."
gcloud run deploy $SERVICE_NAME `
  --source ./backend `
  --region $REGION `
  --project $PROJECT_ID `
  --allow-unauthenticated

if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> [Backend] Deployment Successful!" -ForegroundColor Green
} else {
    Write-Host ">>> [Backend] Deployment Failed!" -ForegroundColor Red
    exit 1
}

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
