# OpSyn — Sales & Browser Automation Platform

> **Final Year Project (FYP)** · Branch: `amna`

OpSyn is an end-to-end automation platform that combines **web scraping**, **browser automation**, and **sales pipeline automation** into a unified system. Built primarily in TypeScript, it leverages the [Apify](https://apify.com/) actor framework for scalable, cloud-ready data extraction alongside a dedicated browser-automation layer and a modular FYP core.

---

## Table of Contents

- [Overview](#overview)
- [Repository Structure](#repository-structure)
- [Modules](#modules)
  - [Browser Automation Script](#browser-automation-script)
  - [Sales Automation](#sales-automation)
  - [Apify Actors](#apify-actors)
  - [OpSyn FYP Module](#opsyn-fyp-module)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

OpSyn automates the full lead-to-sale pipeline:

1. **Scrape** — Apify actors crawl the web and extract structured data without duplicates.
2. **Interact** — Browser automation scripts perform tasks on live web pages (form filling, navigation, data entry).
3. **Sell** — The Sales Automation module processes extracted leads and drives outreach workflows.
4. **Orchestrate** — The `opsyn_fyp_module` ties everything together as the system's central hub.

---

## Repository Structure

```
opsyn-final/                    (branch: amna)
├── Browser-automation-script/  # Headless browser interaction scripts
├── Sales-Automation/           # Lead processing & sales workflow automation
├── opsyn_fyp_module/           # Core FYP orchestration module
├── actor2                      # Apify actor (v2)
├── apify-actor                 # Base Apify web-scraping actor
├── apify-actor-without-duplication  # Deduplication-aware scraping actor
└── .gitignore
```

---

## Modules

### Browser Automation Script

Located in `Browser-automation-script/`, this module controls a headless browser to:

- Navigate websites programmatically
- Fill forms and simulate user interactions
- Extract page content and screenshots
- Integrate with downstream automation pipelines

**Language:** TypeScript

---

### Sales Automation

Located in `Sales-Automation/`, this module takes scraped lead data and automates sales activities:

- Lead enrichment and qualification
- Automated outreach sequencing
- CRM-ready data formatting
- Pipeline status tracking

**Language:** TypeScript

---

### Apify Actors

Three Apify actors ship with this project:

| File | Description |
|------|-------------|
| `apify-actor` | Base web-scraping actor — crawls target pages and extracts raw data |
| `apify-actor-without-duplication` | Enhanced actor that deduplicates results before storing them |
| `actor2` | Secondary actor for additional scraping use-cases |

All actors are deployable directly to the [Apify platform](https://apify.com/) or run locally via the Apify CLI.

**Language:** TypeScript (with supporting Python utilities)

---

### OpSyn FYP Module

Located in `opsyn_fyp_module/`, this is the project's central orchestration layer:

- Coordinates the Browser Automation and Sales Automation modules
- Manages data flow between scrapers and the sales pipeline
- Provides a unified interface for the entire system
- Serves as the primary deliverable for the Final Year Project

**Language:** TypeScript / JavaScript / HTML / CSS / Python

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Primary language | TypeScript (96%) |
| Scripting / utilities | Python (2.4%) |
| Frontend | HTML / CSS (0.9%) |
| Runtime glue | JavaScript (0.5%), Shell (0.1%) |
| Scraping platform | Apify |
| Browser automation | Headless browser (Playwright / Puppeteer) |

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** or **yarn**
- **Python** 3.9+ (for utility scripts)
- **Apify CLI** (for running actors locally)

```bash
npm install -g apify-cli
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Z-vren/opsyn-final.git
cd opsyn-final
git checkout amna

# 2. Install dependencies for the core module
cd opsyn_fyp_module
npm install

# 3. Install dependencies for the browser automation scripts
cd ../Browser-automation-script
npm install

# 4. Install dependencies for the sales automation module
cd ../Sales-Automation
npm install
```

### Running an Apify Actor Locally

```bash
# Navigate to the actor directory
cd apify-actor        # or apify-actor-without-duplication / actor2

# Install dependencies
npm install

# Run with the Apify CLI
apify run
```

### Running the Browser Automation Scripts

```bash
cd Browser-automation-script
npm start
```

### Running the Sales Automation Module

```bash
cd Sales-Automation
npm start
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request against the `amna` branch

Please follow the existing code style and add tests where applicable.

---

## License

See [LICENSE](../../blob/feature/rag-workflow-generator/LICENSE) for details.

---

*OpSyn — Automating the path from data to deal.*