# OPSYN Model Server

FastAPI server for the fine-tuned Qwen2.5-Coder-7B-Instruct model that generates Activepieces workflow JSON from natural language prompts.

**Includes complete post-processing pipeline:**
1. Model inference with system prompt
2. JSON validation and extraction
3. Robust post-processing (fix versions, names, fields)
4. FlowTemplate conversion for UI import

## Setup

### 1. Install Dependencies

```bash
cd opsyn-model-server
pip install -r requirements.txt
```

### 2. Configure Model Path

Copy your LoRA model to the `./model` directory or set the environment variable:

```bash
# Copy model
cp -r ../opsyn_qwen25_coder7b_lora_v2-20251213T120554Z-3-001/opsyn_qwen25_coder7b_lora_v2 ./model

# Or set environment variable
export OPSYN_MODEL_PATH="/path/to/your/lora/model"
```

### 3. Start the Server

```bash
python server.py
```

Or with uvicorn for development:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPSYN_MODEL_PATH` | `./model` | Path to LoRA adapter |
| `OPSYN_BASE_MODEL` | `Qwen/Qwen2.5-Coder-7B-Instruct` | Base model name |
| `OPSYN_DEVICE` | `cuda` (if available) | Device to use |
| `OPSYN_MAX_TOKENS` | `2048` | Default max tokens |
| `PORT` | `8000` | Server port |

## Required Files

The server expects these files in the parent directory:

| File | Description |
|------|-------------|
| `activepieces_embedding_model/` | Fine-tuned sentence-transformer for semantic matching |
| `piece_registry.json` | Registry of pieces with their triggers/actions |

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "embedding_model_loaded": true,
  "device": "cuda",
  "model_path": "./model",
  "embedding_model_path": "../activepieces_embedding_model"
}
```

### Generate Workflow (Complete Pipeline) ⭐ **Main Endpoint**

This endpoint handles everything:
1. Generates raw JSON from model
2. Validates and extracts JSON
3. Post-processes (fixes versions, names, fields)
4. Converts to FlowTemplate for UI import

```bash
POST /generate-workflow
Content-Type: application/json

{
  "prompt": "Create a workflow that sends Slack messages when new rows are added to Google Sheets",
  "max_tokens": 2048,
  "temperature": 0.7
}
```

Response:
```json
{
  "success": true,
  "template": {
    "name": "Sheet to Slack Notification",
    "description": "",
    "pieces": ["@activepieces/piece-google-sheets", "@activepieces/piece-slack"],
    "template": {
      "displayName": "Sheet to Slack Notification",
      "trigger": { ... },
      "valid": true,
      "schemaVersion": "10"
    },
    "blogUrl": ""
  },
  "template_json": "{ ... }",
  "generation_time_ms": 1234.5,
  "post_processing_time_ms": 50.2,
  "model": "Qwen/Qwen2.5-Coder-7B-Instruct + LoRA"
}
```

### Generate Raw Output (No Post-Processing)

For cases where you want the raw model output:

```bash
POST /generate
Content-Type: application/json

{
  "user_prompt": "Create a workflow...",
  "max_tokens": 2048,
  "temperature": 0.7
}
```

### Process Raw Output (Post-Processing Only)

For external model generation, just post-process:

```bash
POST /process
Content-Type: text/plain

{"displayName": "My Flow", "trigger": {...}}
```

## Integration with Activepieces Backend

Set this environment variable in your Activepieces backend:

```bash
export OPSYN_MODEL_URL=http://localhost:8000
```

The backend will call `/generate-workflow` which returns a ready-to-import FlowTemplate.

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User Request                                     │
│  "Create a workflow that sends Slack when new Google Sheets row"        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Python Model Server                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Add SYSTEM_PROMPT                                                   │
│  2. Generate with Qwen2.5-Coder-7B + LoRA                              │
│  3. Extract JSON (handle markdown, truncation)                          │
│  4. Post-process with RobustFlowPostProcessor:                          │
│     ├─ Fix piece versions from piece_registry.json                      │
│     ├─ Fix trigger/action names:                                        │
│     │   ├─ 1st: Hardcoded fixes (fastest)                              │
│     │   ├─ 2nd: Pattern matching (NameMatcher)                         │
│     │   └─ 3rd: Embedding matching (activepieces_embedding_model) 🧠    │
│     ├─ Fix field names (snake_case ↔ camelCase)                        │
│     ├─ Add propertySettings                                             │
│     └─ Remove UI-only fields                                            │
│  5. Convert to FlowTemplate                                             │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FlowTemplate JSON                                 │
│  Ready for import in Activepieces UI                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Name Matching Strategy

The post-processor uses a 3-tier approach to fix trigger/action names:

1. **Hardcoded Fixes** - Common mappings for known issues (instant)
2. **Pattern Matching** - Uses `NameMatcher` with:
   - Exact/normalized matching
   - Token overlap with synonyms
   - Levenshtein edit distance
   - Piece prefix stripping
3. **Embedding Matching** - Uses `activepieces_embedding_model` (fine-tuned sentence-transformer) for semantic similarity when pattern matching fails

## GPU Requirements

- **Recommended**: NVIDIA GPU with 16GB+ VRAM (A100, V100, RTX 4090)
- **Minimum**: 8GB VRAM with 4-bit quantization
- **CPU Mode**: Slow but works (set `OPSYN_DEVICE=cpu`)

## Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["python", "server.py"]
```

Build and run:
```bash
docker build -t opsyn-model-server .
docker run -p 8000:8000 -v /path/to/model:/app/model --gpus all opsyn-model-server
```

