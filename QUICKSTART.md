# Democracy Litigation - Quick Start Guide

Get started with the Democracy Litigation plugin in minutes.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - For case/document storage
- **Nexus API Key** - [Get one here](https://dashboard.adverant.ai/settings/api-keys)
- **GeoAgent Access** - For geographic analysis features

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/adverant/adverant-nexus-democracy-litigation.git
cd adverant-nexus-democracy-litigation
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required: Nexus API Key
NEXUS_API_KEY=your_nexus_api_key_here

# Required: Database Connection
DATABASE_URL=postgresql://user:password@localhost:5432/democracy_litigation

# Service URLs (defaults work for local development)
NEXUS_GRAPHRAG_URL=http://localhost:9000
NEXUS_MAGEAGENT_URL=http://localhost:9010
GEOAGENT_BASE_URL=http://localhost:3000/dashboard/data-explorer

# Optional: OpenRouter for advanced AI features
OPENROUTER_API_KEY=your_openrouter_key
```

### 4. Initialize Database

```bash
npm run db:migrate
npm run db:seed  # Optional: load sample data
```

### 5. Start Development Server

```bash
npm run dev
```

The plugin will be available at `http://localhost:3000/dashboard/democracy-litigation`

---

## Your First Case

### Step 1: Create a Case

Navigate to **Cases → New Case** or use the API:

```typescript
import { DemocracyLitigationClient } from '@adverant/democracy-litigation';

const client = new DemocracyLitigationClient({
  apiKey: process.env.NEXUS_API_KEY
});

const newCase = await client.cases.create({
  name: "Example v. State Election Board",
  caseNumber: "2024-cv-001",
  jurisdiction: "TX",
  caseType: "redistricting",
  legalClaims: ["VRA Section 2"]
});

console.log(`Created case: ${newCase.id}`);
```

### Step 2: Upload Documents

Drag and drop documents in the UI, or use the API:

```typescript
const documents = await client.documents.upload(newCase.id, [
  { file: legislativeRecord, docType: 'legislative_record' },
  { file: expertReport, docType: 'expert_report' }
]);

console.log(`Uploaded ${documents.length} documents`);
```

### Step 3: Triage Documents

Let AI score documents for relevance and privilege:

```typescript
const triage = await client.documents.triage({
  documentIds: documents.map(d => d.id),
  triageSettings: {
    relevanceThreshold: 0.7,
    privilegeThreshold: 0.8
  }
});

console.log(`High relevance: ${triage.summary.highRelevance}`);
console.log(`Flagged privilege: ${triage.summary.privilegeFlagged}`);
```

### Step 4: Research VRA Precedents

Search the knowledge graph for relevant case law:

```typescript
const precedents = await client.research.searchVRAPrecedents({
  query: "Gingles compactness requirement",
  circuits: ["5th"],
  ginglesIssues: ["Gingles_I_Compactness"]
});

precedents.cases.forEach(c => {
  console.log(`${c.citation}: ${c.holding}`);
});
```

### Step 5: Geographic Analysis

Embed GeoAgent for district analysis:

```tsx
import { GeoAgentEmbed } from '@/components/democracy-litigation/geographic/GeoAgentEmbed';

<GeoAgentEmbed
  caseId={newCase.id}
  view="explore"
  height="800px"
  data={{
    districts: texasDistricts,
    census: texasCensusBlocks,
    precincts: texasPrecincts
  }}
  onCompactnessCalculated={(metrics) => {
    console.log('Polsby-Popper:', metrics.polsby_popper);
  }}
/>
```

---

## Key Features

### Case Management

| Feature | Location |
|---------|----------|
| Create/Edit Cases | `/dashboard/democracy-litigation/cases` |
| View Case Timeline | `/dashboard/democracy-litigation/cases/[id]` |
| Track Deadlines | `/dashboard/democracy-litigation/deadlines` |

### Document Processing

| Feature | Location |
|---------|----------|
| Upload Documents | `/dashboard/democracy-litigation/discovery/upload` |
| AI Triage | `/dashboard/democracy-litigation/discovery/triage` |
| Document Viewer | `/dashboard/democracy-litigation/documents/[id]` |

### VRA Research

| Feature | Location |
|---------|----------|
| Precedent Search | `/dashboard/democracy-litigation/research/vra-precedents` |
| Circuit Comparison | `/dashboard/democracy-litigation/research/circuit-comparison` |
| Legislative History | `/dashboard/democracy-litigation/research/legislative-history` |

### Geographic Analysis

| Feature | Location |
|---------|----------|
| Interactive Maps | `/dashboard/democracy-litigation/geographic/maps` |
| Compactness Metrics | `/dashboard/democracy-litigation/geographic/compactness` |
| Demographics | `/dashboard/democracy-litigation/geographic/demographics` |

### Expert Witnesses

| Feature | Location |
|---------|----------|
| Expert Database | `/dashboard/democracy-litigation/experts` |
| Track Records | `/dashboard/democracy-litigation/experts/[id]` |

---

## Common Workflows

### Redistricting Challenge

1. **Create case** with VRA Section 2 claim
2. **Upload** legislative history documents
3. **Triage** documents for relevance
4. **Research** Gingles precedents in your circuit
5. **Analyze** district compactness via GeoAgent
6. **Prepare** expert report data
7. **Track** court deadlines

### Voter ID Challenge

1. **Create case** with ballot access claim
2. **Upload** discovery documents
3. **Research** voter ID precedents
4. **Analyze** demographic impact data
5. **Track** litigation milestones

---

## API Quick Reference

### Cases

```bash
# List cases
GET /api/v1/democracy-litigation/cases

# Create case
POST /api/v1/democracy-litigation/cases

# Get case
GET /api/v1/democracy-litigation/cases/:id

# Update case
PATCH /api/v1/democracy-litigation/cases/:id
```

### Documents

```bash
# Upload
POST /api/v1/democracy-litigation/cases/:caseId/documents

# Triage
POST /api/v1/democracy-litigation/documents/triage

# List
GET /api/v1/democracy-litigation/cases/:caseId/documents
```

### Research

```bash
# VRA search
POST /api/v1/democracy-litigation/research/vra-search

# Circuit comparison
POST /api/v1/democracy-litigation/research/circuit-comparison
```

### Geographic

```bash
# Census alignment
POST /api/v1/democracy-litigation/cases/:caseId/geo/census-alignment

# Compactness
POST /api/v1/democracy-litigation/geo/compactness
```

---

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"
```

### API Key Invalid

1. Verify key at [dashboard.adverant.ai/settings/api-keys](https://dashboard.adverant.ai/settings/api-keys)
2. Ensure key has `democracy-litigation` scope
3. Check key hasn't expired

### GeoAgent Not Loading

1. Verify `GEOAGENT_BASE_URL` in `.env`
2. Check GeoAgent service is running
3. Ensure authentication token is valid

### Document Triage Slow

- Large documents (>100 pages) may take longer
- Check `NEXUS_GRAPHRAG_URL` connectivity
- Consider batching documents (max 50 per request)

---

## Next Steps

1. **Read the full documentation:** [/docs](./docs)
2. **Explore use cases:** [USE-CASES.md](./USE-CASES.md)
3. **Review architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **API reference:** [TECHNICAL.md](./TECHNICAL.md)

---

## Getting Help

- **Documentation:** [/docs](./docs)
- **GitHub Issues:** [Report a bug](https://github.com/adverant/adverant-nexus-democracy-litigation/issues)
- **Discussions:** [Ask questions](https://github.com/adverant/adverant-nexus-democracy-litigation/discussions)
- **Email:** support@adverant.ai

---

## Research Paper

For the full technical analysis behind this platform, see:

**[Democracy Litigation AI: Multi-Agent Platform for Voting Rights Act Litigation](https://adverant.ai/docs/research/democracy-litigation-platform)**

> This research introduces an AI platform combining large-scale discovery triage, legislative history reconstruction, VRA precedent research, and automated geographic analysis for voting rights litigation.
