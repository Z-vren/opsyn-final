#!/bin/bash
# Script to selectively commit OpSyn AI workflow generation feature

cd "$(dirname "$0")"

echo "Adding core model server files..."
git add opsyn-model-server/postprocessor_v2.py
git add opsyn-model-server/server_v2.py
git add opsyn-model-server/smart_matcher.py
git add opsyn-model-server/modal_app_v2.py
git add opsyn-model-server/.gitignore
git add opsyn-model-server/requirements.txt
git add opsyn-model-server/setup_venv.sh

echo "Adding frontend/backend integration..."
git add packages/react-ui/src/features/opsyn/
git add packages/server/api/src/app/opsyn/
git add packages/react-ui/src/features/flows/lib/create-flow-dropdown.tsx
git add packages/server/api/src/app/app.ts
git add packages/server/api/src/app/flows/flow/flow.controller.ts

echo "Adding package.json changes..."
git add package.json
git add package-lock.json
git add packages/server/api/project.json

echo "Adding gitignore updates..."
git add .gitignore

echo ""
echo "=== Staged files ==="
git status --short

echo ""
echo "Ready to commit! Run:"
echo "  git commit -m 'Add OpSyn AI workflow generation feature'"
echo "  git push origin feature/rag-workflow-generator"
