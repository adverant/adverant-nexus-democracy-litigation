# Democracy Litigation - Technical Specifications

Detailed technical documentation for the Democracy Litigation plugin.

---

## API Reference

### Base URL

```
Production: https://api.adverant.ai/v1/democracy-litigation
Development: http://localhost:8080/api/v1/democracy-litigation
```

### Authentication

All API requests require a valid Nexus API key:

```bash
curl -H "Authorization: Bearer YOUR_NEXUS_API_KEY" \
     https://api.adverant.ai/v1/democracy-litigation/cases
```

---

## Cases API

### Create Case

```http
POST /cases
Content-Type: application/json

{
  "name": "Texas NAACP v. Abbott (Redistricting)",
  "caseNumber": "1:21-cv-00991",
  "courtName": "W.D. Texas",
  "jurisdiction": "Texas",
  "caseType": "redistricting",
  "legalClaims": ["VRA Section 2", "14th Amendment"],
  "plaintiffs": [
    {
      "name": "Texas NAACP",
      "type": "organization",
      "counsel": "Elias Law Group"
    }
  ],
  "defendants": [
    {
      "name": "Governor Greg Abbott",
      "type": "official",
      "counsel": "Texas Attorney General"
    }
  ],
  "filingDate": "2021-10-18",
  "status": "active"
}
```

**Response:**

```json
{
  "id": "case-uuid-here",
  "name": "Texas NAACP v. Abbott (Redistricting)",
  "caseNumber": "1:21-cv-00991",
  "createdAt": "2024-01-15T10:30:00Z",
  "status": "active"
}
```

### List Cases

```http
GET /cases?status=active&caseType=redistricting&page=1&pageSize=20
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `active`, `closed`, `settled`, `appeal` |
| `caseType` | string | Filter by type: `redistricting`, `voter_id`, `ballot_access`, `administration` |
| `jurisdiction` | string | Filter by state (e.g., `TX`, `GA`) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20, max: 100) |

### Get Case Details

```http
GET /cases/:id
```

### Update Case

```http
PATCH /cases/:id
Content-Type: application/json

{
  "status": "discovery",
  "metadata": {
    "discoveryDeadline": "2024-06-15"
  }
}
```

---

## Documents API

### Upload Document

```http
POST /cases/:caseId/documents
Content-Type: multipart/form-data

file: <binary>
docType: legislative_record
tags: ["redistricting", "committee_hearing"]
```

**Supported Document Types:**

| Type | Description |
|------|-------------|
| `legislative_record` | Committee hearings, floor debates, amendments |
| `expert_report` | Expert witness reports and exhibits |
| `deposition` | Deposition transcripts |
| `discovery` | General discovery documents |
| `court_filing` | Motions, briefs, orders |
| `voter_file` | Voter registration data |
| `election_results` | Precinct-level election data |
| `correspondence` | Emails, letters, memos |

### Triage Documents

AI-powered document relevance scoring and privilege detection.

```http
POST /documents/triage
Content-Type: application/json

{
  "documentIds": ["doc-1", "doc-2", "doc-3"],
  "triageSettings": {
    "relevanceThreshold": 0.7,
    "privilegeThreshold": 0.8,
    "priorityCategories": [
      "legislative_intent",
      "demographic_data",
      "racial_language"
    ]
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "documentId": "doc-1",
      "relevanceScore": 0.92,
      "privilegeScore": 0.15,
      "categories": ["legislative_intent"],
      "suggestedReviewPriority": "high"
    }
  ],
  "summary": {
    "totalProcessed": 3,
    "highRelevance": 1,
    "mediumRelevance": 1,
    "lowRelevance": 1,
    "privilegeFlagged": 0
  },
  "processingTimeMs": 1250
}
```

### List Documents

```http
GET /cases/:caseId/documents?docType=discovery&relevanceScoreMin=0.7
```

---

## VRA Research API

### Search Precedents

```http
POST /research/vra-search
Content-Type: application/json

{
  "query": "Gingles I compactness standard",
  "ginglesIssues": ["Gingles_I_Compactness", "Gingles_I_Numerosity"],
  "circuits": ["5th", "11th"],
  "dateFrom": "2020-01-01",
  "includeSupreme": true,
  "limit": 20
}
```

**Response:**

```json
{
  "cases": [
    {
      "id": "case-uuid",
      "citation": "Allen v. Milligan, 599 U.S. 1 (2023)",
      "court": "Supreme Court",
      "date": "2023-06-08",
      "ginglesIssues": ["Gingles_I_Compactness"],
      "holding": "Reaffirmed Gingles framework...",
      "relevanceScore": 0.95,
      "citedByCount": 47
    }
  ],
  "totalResults": 156
}
```

### Circuit Split Analysis

```http
POST /research/circuit-comparison
Content-Type: application/json

{
  "issue": "Gingles_I_Compactness",
  "circuits": ["5th", "9th", "11th"]
}
```

**Response:**

```json
{
  "issue": "Gingles_I_Compactness",
  "circuits": [
    {
      "circuit": "5th",
      "standard": "Reasonably compact minority-majority district must be possible",
      "keyPrecedent": "LULAC v. Perry, 548 U.S. 399 (2006)",
      "requirements": [
        "Geographic compactness",
        "Majority-minority possibility",
        "Traditional districting principles"
      ]
    }
  ],
  "splitAnalysis": {
    "conflictingHoldings": ["..."],
    "recommendedApproach": "..."
  }
}
```

### Legislative History Reconstruction

```http
POST /cases/:caseId/legislative-history
Content-Type: application/json

{
  "documentIds": ["doc-1", "doc-2", "doc-3"],
  "options": {
    "extractActors": true,
    "detectRacialLanguage": true,
    "generateCitations": true
  }
}
```

---

## Geographic Analysis API

### Census-to-Precinct Alignment

```http
POST /cases/:caseId/geo/census-alignment
Content-Type: application/json

{
  "censusData": {
    "type": "FeatureCollection",
    "features": [...]
  },
  "precinctData": {
    "type": "FeatureCollection",
    "features": [...]
  },
  "h3Resolution": 9,
  "alignmentMethod": "population_weighted"
}
```

**H3 Resolution Guidelines:**

| Resolution | Hex Area | Use Case |
|------------|----------|----------|
| 7 | ~5.16 km² | State-level overview |
| 8 | ~0.74 km² | County-level analysis |
| 9 | ~0.11 km² | Precinct alignment (recommended) |
| 10 | ~0.015 km² | High-precision analysis |

### Calculate Compactness

```http
POST /geo/compactness
Content-Type: application/json

{
  "districtIds": ["TX-01", "TX-02", "TX-35"],
  "metrics": ["polsby_popper", "reock", "convex_hull", "schwartzberg"]
}
```

**Response:**

```json
{
  "districts": [
    {
      "id": "TX-35",
      "polsbyPopper": 0.12,
      "reock": 0.18,
      "convexHull": 0.35,
      "schwartzberg": 0.28,
      "benchmark": {
        "polsbyPopper": 0.35,
        "reock": 0.42
      },
      "percentileRank": 5
    }
  ]
}
```

### Export for Expert Analysis

```http
POST /cases/:caseId/geo/export
Content-Type: application/json

{
  "format": "R",
  "dataTypes": ["demographics", "election_results", "boundaries"],
  "includeGeometry": true
}
```

**Supported Export Formats:**

| Format | Description |
|--------|-------------|
| `R` | RData format for R statistical packages |
| `stata` | DTA format for Stata |
| `python` | Pickle/CSV for Python analysis |
| `geojson` | GeoJSON for mapping tools |
| `shapefile` | ESRI Shapefile format |

---

## Expert Witnesses API

### List Experts

```http
GET /experts?specialty=RPV_analysis&sortBy=testimonyCount
```

### Get Expert Profile

```http
GET /experts/:id
```

**Response:**

```json
{
  "id": "expert-uuid",
  "name": "Dr. Jane Doe",
  "specialty": "Racially Polarized Voting Analysis",
  "affiliation": "University of Texas",
  "testimonyCount": 23,
  "daubertRecord": {
    "challenges": 5,
    "excluded": 1,
    "admitted": 4
  },
  "methodologies": [
    "Ecological Inference",
    "Homogeneous Precinct Analysis",
    "King's EI"
  ],
  "jurisdictions": ["TX", "GA", "LA", "MS"],
  "recentCases": [...]
}
```

### Generate Expert Report

```http
POST /cases/:caseId/expert-report
Content-Type: application/json

{
  "templateType": "rpv_analysis",
  "data": {
    "districts": [...],
    "elections": [...],
    "demographics": [...]
  },
  "sections": [
    "qualifications",
    "methodology",
    "data_sources",
    "statistical_analysis",
    "conclusions"
  ]
}
```

---

## Deadlines API

### Create Deadline

```http
POST /deadlines
Content-Type: application/json

{
  "caseId": "case-123",
  "title": "Expert report deadline",
  "deadlineDate": "2024-03-15",
  "deadlineType": "expert_report",
  "priority": "critical",
  "cascadeFrom": "discovery_close",
  "alertIntervals": [14, 7, 3, 1],
  "dependencies": ["data_preparation", "expert_retention"]
}
```

**Deadline Types:**

| Type | Description |
|------|-------------|
| `discovery_open` | Discovery period begins |
| `discovery_close` | Discovery period ends |
| `expert_report` | Expert report due |
| `deposition` | Deposition deadline |
| `motion` | Motion filing deadline |
| `trial` | Trial date |
| `appeal` | Appeal deadline |

### List Upcoming Deadlines

```http
GET /deadlines?upcoming=30&status=pending&priority=critical
```

---

## Database Schema

### Core Tables

```sql
-- Cases table
CREATE TABLE dl.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  case_number VARCHAR(100),
  court_name VARCHAR(200),
  jurisdiction VARCHAR(50),
  case_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  legal_claims JSONB,
  plaintiffs JSONB,
  defendants JSONB,
  filing_date DATE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE dl.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES dl.cases(id),
  title VARCHAR(500),
  doc_type VARCHAR(50),
  file_url TEXT,
  content TEXT,
  relevance_score DECIMAL(3,2),
  privilege_score DECIMAL(3,2),
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Expert witnesses table
CREATE TABLE dl.expert_witnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  specialty VARCHAR(200),
  affiliation VARCHAR(300),
  testimony_count INTEGER DEFAULT 0,
  daubert_record JSONB,
  methodologies TEXT[],
  jurisdictions TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deadlines table
CREATE TABLE dl.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES dl.cases(id),
  title VARCHAR(500) NOT NULL,
  deadline_date DATE NOT NULL,
  deadline_type VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'pending',
  dependencies JSONB,
  alert_intervals INTEGER[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Precedents knowledge graph
CREATE TABLE dl.precedents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citation VARCHAR(300) NOT NULL,
  court VARCHAR(100),
  date DATE,
  gingles_issues TEXT[],
  holding TEXT,
  circuit VARCHAR(20),
  cited_by_count INTEGER DEFAULT 0,
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

```sql
-- Full-text search indexes
CREATE INDEX idx_documents_content ON dl.documents USING GIN(to_tsvector('english', content));
CREATE INDEX idx_precedents_search ON dl.precedents USING GIN(search_vector);

-- Query optimization indexes
CREATE INDEX idx_documents_case ON dl.documents(case_id);
CREATE INDEX idx_documents_type ON dl.documents(doc_type);
CREATE INDEX idx_deadlines_case ON dl.deadlines(case_id);
CREATE INDEX idx_deadlines_date ON dl.deadlines(deadline_date);
CREATE INDEX idx_cases_jurisdiction ON dl.cases(jurisdiction);
```

---

## TypeScript SDK

### Installation

```bash
npm install @adverant/democracy-litigation
```

### Basic Usage

```typescript
import { DemocracyLitigationClient } from '@adverant/democracy-litigation';

const client = new DemocracyLitigationClient({
  apiKey: process.env.NEXUS_API_KEY,
  baseUrl: 'https://api.adverant.ai/v1/democracy-litigation'
});

// Create a case
const newCase = await client.cases.create({
  name: "Texas NAACP v. Abbott",
  caseNumber: "1:21-cv-00991",
  jurisdiction: "TX",
  caseType: "redistricting"
});

// Upload documents
const docs = await client.documents.upload(newCase.id, files);

// Triage documents
const triage = await client.documents.triage({
  documentIds: docs.map(d => d.id),
  triageSettings: { relevanceThreshold: 0.7 }
});
```

### Type Definitions

See [types/democracy-litigation.ts](./ui/src/types/democracy-litigation.ts) for complete TypeScript definitions (1500+ lines).

---

## Error Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid parameters |
| `401` | Unauthorized - Invalid or missing API key |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists |
| `422` | Unprocessable Entity - Validation error |
| `429` | Rate Limited - Too many requests |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid case type",
    "details": {
      "field": "caseType",
      "allowedValues": ["redistricting", "voter_id", "ballot_access"]
    }
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Standard endpoints | 1000 requests/minute |
| Document upload | 100 requests/minute |
| AI processing (triage, research) | 50 requests/minute |
| Export endpoints | 20 requests/minute |

---

## Webhooks

### Configure Webhooks

```http
POST /webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["deadline.approaching", "case.updated", "document.triaged"],
  "secret": "your-webhook-secret"
}
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `deadline.approaching` | Deadline within alert interval |
| `deadline.passed` | Deadline has passed |
| `case.created` | New case created |
| `case.updated` | Case status changed |
| `document.uploaded` | Document uploaded |
| `document.triaged` | Document triage complete |
| `research.complete` | Research query complete |

---

## Support

- **API Status:** https://status.adverant.ai
- **Documentation:** https://docs.adverant.ai/democracy-litigation
- **Issues:** [GitHub Issues](https://github.com/adverant/adverant-nexus-democracy-litigation/issues)
- **Email:** api-support@adverant.ai
