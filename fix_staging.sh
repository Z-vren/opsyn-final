#!/bin/bash
# Unstage files that shouldn't be committed

cd "$(dirname "$0")"

echo "Unstaging RAG files (not using them)..."
git restore --staged opsyn-model-server/rag/README.md
git restore --staged opsyn-model-server/rag/llm_client.py
git restore --staged opsyn-model-server/rag/requirements.txt
git restore --staged opsyn-model-server/rag/retriever.py
git restore --staged opsyn-model-server/rag/workflow_generator.py

echo "Unstaging .env file (contains secrets!)..."
git restore --staged packages/server/api/.env

echo "Unstaging temp files..."
git restore --staged piece_registry.json
git restore --staged PIPELINE_SUMMARY.md
git restore --staged __pycache__/embedding_matcher.cpython-312.pyc
git restore --staged __pycache__/robust_post_processor.cpython-312.pyc

echo "Unstaging old pipeline code..."
git restore --staged src/opsyn/flowPostProcessor.ts
git restore --staged src/opsyn/index.ts

echo ""
echo "=== Final staged files ==="
git status --short

echo ""
echo "✅ Ready to commit! Only essential files are staged."
