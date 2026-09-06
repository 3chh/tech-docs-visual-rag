# TechDocs Visual RAG

> **Section-Level Visual RAG for Technical Documentation, Engineering Manuals, and Standards Verification**

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-ColQwen--2.5-EE4C2C.svg)](https://pytorch.org/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Multi--Vector-DC2626.svg)](https://qdrant.tech/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

---

## Overview

**TechDocs Visual RAG** is an advanced visual retrieval-augmented generation system engineered specifically for dense technical documents, scanned engineering manuals, operational handbooks, and compliance standards (e.g., ISO, QCVN, TCVN).

Unlike conventional RAG pipelines that rely on lossy text extraction or single-page image chunking:
1. **Zero Text Extraction Bottlenecks**: Document pages are treated as high-fidelity visual representations. Embeddings are generated directly via **ColQwen** (vision-language multi-vector retriever), preserving complex layouts, schematics, engineering tables, and mathematical formulas without degradation.
2. **True Section-Level Retrieval**: Chunks correspond to real hierarchical sections defined in the document's actual Table of Contents (TOC) — stitching cross-page sections into continuous visual units.
3. **Interactive Document Canvas**: Real-time side-by-side inspection between retrieved section crops and continuous multi-page PDF canvas with synchronized page scrolling, drag-pan, and instant citation jumping.
4. **Formula & Equation Rendering**: Full mathematical formula support rendering LaTeX expressions via KaTeX.

---

## System Architecture

```
                    ┌────────────────────────┐         ┌────────────────────────┐
                    │    Web Application     │ ──────► │       vLLM / VLM       │  :3333
                    │  React + Vite + shadcn │  HTTP   │  Vision Language Model │  (InternVL3 / Qwen2-VL)
                    │       (Port 7860)      │         │     GPU Container      │  vllm/vllm-openai
                    └───────────┬────────────┘         └───────────▲────────────┘
                                │ HTTP                             │
                    ┌───────────▼────────────┐                     │
        ┌───────────┤      API Gateway       ├─────────────────────┘
        │           │   FastAPI (Port 2005)  │
        │           │     ColQwen (GPU)      │
        │ HTTP      └───────────┬────────────┘
        │                       │ gRPC
┌───────▼────────┐      ┌───────▼────────┐
│   PDF Worker   │      │     Qdrant     │  :6333 / :6334
│ PaddleOCR GPU  │      │  Multi-Vector  │
│   (Port 2222)  │      └────────────────┘
└───────┬────────┘
        │ writes stitched section crops
┌───────▼────────────────┐
│   Shared Volume /data  │  Worker writes crops & metadata; API & Web App consume
└────────────────────────┘
```

### Decoupled Service Tiering
Services are strictly separated according to their **VRAM and compute profiles** to prevent out-of-memory (OOM) failures:
* **API Service** (`:2005`): Houses ColQwen visual multi-vector embeddings and vector search orchestration.
* **PDF Worker** (`:2222`): Manages PaddleOCR, document layout analysis, and cross-page section image stitching.
* **vLLM Service** (`:3333`): Hosts the Vision-Language Model (VLM) for answer generation.
* **Qdrant Vector DB** (`:6333`): Multi-vector storage with two-stage prefetch and reranking.
* **Web Frontend** (`:7860`): Static production bundle served by high-performance Nginx.

---

## Deployment Profiles

Choose the profile that matches your available hardware:

| Profile Target | Command | Required VRAM | Description |
|---|---|---|---|
| **Demo (No GPU)** | `make deploy-demo` | **0 GB** | Lightweight stdlib mock backend + full React UI. Ideal for immediate review and testing. |
| **Hybrid (Recommended)** | `make deploy-hybrid` | **16 GB** | ColQwen self-hosted locally + VLM via external API (OpenAI / Gemini / Custom). |
| **Full Stack** | `make deploy-full` | **24 GB** | Completely self-hosted stack including local vLLM (InternVL3-8B). |
| **Worker Node** | `make deploy-worker-node` | **8 GB** | Dedicated document ingestion & OCR node. |
| **GPU Query Node** | `make deploy-gpu-node` | **16 GB** | Dedicated retrieval & answer generation node. |

---

## Quick Start

### 1. Instant Preview (No GPU Required)

Run the full modern web interface locally in less than 30 seconds:

```bash
git clone https://github.com/3chh/tech-docs-visual-rag.git
cd tech-docs-visual-rag

make deploy-demo
```
Open **[http://localhost:7860](http://localhost:7860)** in your browser.

---

### 2. Full GPU Deployment

**Prerequisites**: Docker Engine with [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

```bash
# 1. Setup environment configuration
cp .env.example .env

# Generate encryption secret for credentials
openssl rand -base64 32
# Copy and set CREDENTIALS_SECRET in .env

# 2. Launch complete stack
make deploy-full
```

#### Monitoring Deployment
```bash
make logs-vllm     # Follow model weight download & server initialization
make health        # Verify healthcheck status across all endpoints
make ps            # Inspect container status
make down          # Stop all services
```

---

### 3. Public Production Deployment with TLS

To deploy in production behind automated TLS (Let's Encrypt) and Caddy reverse proxy:

```bash
make deploy-full PUBLIC=1 DOMAIN=docs.yourdomain.com
```

* Binds internal ports to loopback (`127.0.0.1`), exposing only standard web ports (`80/443`).
* Automatic HTTPS certificate provisioning via Let's Encrypt.
* Basic authentication gate configurable via `BASIC_AUTH_HASH`.

---

## Key Features

### 🔍 Section-Level Hierarchical Retrieval
* **Dynamic PDF Rasterization**: High-resolution rendering with adaptive DPI, page-splitting, and margin trimming.
* **Layout-Aware Chunking**: Delineates sections based on actual Table of Contents boundaries rather than arbitrary token counts.
* **Two-Tier Vector Search**: Fast HNSW prefetch on pooled visual vectors followed by full MaxSim multi-vector late interaction reranking.

### 🖥️ Dual-Mode Interactive Inspection
* **Crop Mode**: Inspect cropped image sections directly matched with retrieved answers.
* **Original Document Canvas**: Seamless switch to continuous multi-page PDF view with mouse wheel scroll, fluid drag-to-pan, and dynamic zoom (25% – 300%).
* **Active Outline Synchronization**: Expandable Table of Contents tree enabling instant jumps to exact document pages.

### 📐 Scientific & Engineering Formula Support
* Native parsing and client-side KaTeX rendering for complex mathematical formulations, physical parameters, and technical bounds.

### 🔐 Security & Credential Isolation
* **Zero Keys in Environment**: Model API keys are never stored in plaintext `.env` files or Git.
* **At-Rest Fernet Encryption**: API keys configured via UI are encrypted using keys derived from `CREDENTIALS_SECRET`.
* **Masked Delivery**: Secret values are permanently masked (`sk-proj-••••4f2a`) across all API responses.

---

## Configuration Reference

Key configuration options available in `.env`:

| Parameter | Default | Description |
|---|---|---|
| `CREDENTIALS_SECRET` | *None* | **Required.** Base64 secret key used for encrypting API credentials at rest. |
| `DEFAULT_VLM_PROVIDER` | `none` | Set to `builtin` for auto-provisioned internal vLLM in `deploy-full`. |
| `VLM_MODEL_NAME` | `OpenGVLab/InternVL3-8B` | Target VLM model weights loaded into vLLM. |
| `VLLM_GPU_MEMORY_UTILIZATION` | `0.35` | Memory cap for vLLM to preserve VRAM for ColQwen and OCR. |
| `EMBEDDING_MAX_NUM_VISUAL_TOKENS` | `8192` | Maximum visual tokens allocated per section image. |
| `EMBEDDING_MIN_WIDTH` | `600` | Normalized minimum width for section crops. |
| `VECTORDB_TYPE` | `qdrant-standalone` | Vector database backend (`qdrant-standalone` \| `milvus-standalone`). |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |

See [.env.example](.env.example) for the complete list of parameters and documentation.

---

## Hardware Sizing Guide

| Setup | Minimum VRAM | Recommended Hardware | Suitable Workload |
|---|---|---|---|
| **Demo Mode** | 0 GB | Any modern CPU, 4GB RAM | UI evaluation, layout review, mock testing |
| **Hybrid Mode** | 16 GB | RTX 4080, RTX 3090, T4, A10G | ColQwen retrieval locally + Cloud VLM (Gemini/OpenAI) |
| **Full Stack** | 24 GB | RTX 4090, RTX 3090 (24GB), A5000 | Fully offline, on-premise technical RAG |
| **Multi-GPU** | 2x 16GB+ | 2x RTX 3090 / A10G / A100 | High-throughput concurrent indexing and multi-user querying |

---

## API Endpoints Overview

The backend exposes a clean REST API on port `2005`:

* `GET /health` — Service health verification and version info.
* `POST /search_with_images` — Semantic section search returning multi-vector matches with base64 visual crops.
* `POST /ask` — End-to-end question answering proxied through configured VLM provider.
* `GET /collections` — List all document collections and readiness states.
* `POST /collections` — Create document collection with designated VLM/LLM connections.
* `GET /connections` — Retrieve configured model provider connections (masked).
* `POST /connections` — Register and encrypt model connection credentials.
* `GET /settings` — Inspect runtime system configurations and override allowances.

Full interactive OpenAPI documentation is accessible at `http://localhost:2005/docs`.

---

## Local Development

### Backend API
```bash
# Setup virtual environment
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows

pip install -r backend/requirements.txt -r backend/requirements-dev.txt
uvicorn backend.app.main:app --reload --port 2005
```

### PDF Worker
```bash
pip install -r backend/requirements-worker.txt
uvicorn backend.worker.main:app --reload --port 2222
```

### Web Frontend
```bash
cd frontend
npm install
npm run dev
```

### Automated Testing
```bash
# Run backend test suite (does not require GPU)
pytest
```

---

## Documentation Links

* **[docs/MODEL_HOSTING.md](docs/MODEL_HOSTING.md)**: Model selection, VRAM allocation strategies, and multi-GPU partitioning.
* **[docs/VERIFICATION.md](docs/VERIFICATION.md)**: Test verification matrices and deployment checks.
* **[docs/MIGRATION.md](docs/MIGRATION.md)**: Architectural migration notes and compatibility mappings.
* **[backend/README.md](backend/README.md)**: Backend modules, pipeline schemas, and algorithms.
* **[frontend/README.md](frontend/README.md)**: Frontend state architecture, components, and styling guide.
