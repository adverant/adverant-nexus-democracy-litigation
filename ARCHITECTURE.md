# Democracy Litigation - Architecture

System design and component architecture for the Democracy Litigation plugin.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 NEXUS DEMOCRACY LITIGATION PLATFORM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    CASE MANAGEMENT DASHBOARD                          │  │
│  │  • n+ Active Cases (VRA Section 2, redistricting, voter access)      │  │
│  │  • Real-time deadline tracking with cascade dependencies             │  │
│  │  • Cross-case pattern detection and strategy coordination            │  │
│  │  • Opposing counsel intelligence and litigation history              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌───────────────┐ │
│  │  DOCUMENT PROCESSING   │  │   VRA RESEARCH ENGINE  │  │  GEOAGENT     │ │
│  │  • Discovery Triage    │  │   • Section 2 Cases    │  │  INTEGRATION  │ │
│  │  • OCR + Extraction    │  │   • Gingles Analysis   │  │  • iframe     │ │
│  │  • Relevance Scoring   │  │   • Circuit Splits     │  │  • 500 LOC    │ │
│  │  • Privilege Detection │  │   • Senate Factors     │  │  • postMsg    │ │
│  └────────────────────────┘  └────────────────────────┘  └───────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                   GEOGRAPHIC ANALYSIS (VIA GEOAGENT)                  │ │
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │ │
│  │  │ H3 Hexagonal    │───►│ Census-Precinct  │───►│ Compactness     │  │ │
│  │  │ Grid Alignment  │    │ Alignment        │    │ Metrics         │  │ │
│  │  └─────────────────┘    └──────────────────┘    └─────────────────┘  │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │ │
│  │  │ RPV Analysis    │───►│ EI Statistical   │───►│ Expert Report   │  │ │
│  │  │ (EI, King's)    │    │ Validation       │    │ Generation      │  │ │
│  │  └─────────────────┘    └──────────────────┘    └─────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        EXPERT WITNESS SYSTEM                          │ │
│  │  • Track record analysis (testimony history, Daubert challenges)      │ │
│  │  • Methodology patterns and software tools used                       │ │
│  │  • Judicial reception and credibility findings                        │ │
│  │  • Automated data preparation for expert analysis                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (Next.js 14)

```
ui/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       └── democracy-litigation/
│   │           ├── page.tsx                    # Overview dashboard
│   │           ├── layout.tsx                  # Navigation layout
│   │           ├── cases/
│   │           │   ├── page.tsx                # Case list
│   │           │   └── [id]/page.tsx           # Case detail
│   │           ├── documents/
│   │           │   ├── page.tsx                # Document list
│   │           │   └── [id]/page.tsx           # Document viewer
│   │           ├── discovery/
│   │           │   ├── upload/page.tsx         # Document upload
│   │           │   └── triage/page.tsx         # AI triage interface
│   │           ├── research/
│   │           │   ├── vra-precedents/page.tsx # VRA precedent search
│   │           │   └── circuit-comparison/     # Circuit split analysis
│   │           ├── geographic/
│   │           │   ├── maps/page.tsx           # GeoAgent map view
│   │           │   ├── compactness/page.tsx    # Compactness analysis
│   │           │   └── demographics/page.tsx   # Demographic analysis
│   │           ├── experts/
│   │           │   ├── page.tsx                # Expert list
│   │           │   └── [id]/page.tsx           # Expert profile
│   │           └── deadlines/page.tsx          # Deadline calendar
│   │
│   ├── components/
│   │   └── democracy-litigation/
│   │       ├── cases/
│   │       │   ├── CaseCard.tsx
│   │       │   ├── CaseForm.tsx
│   │       │   └── CaseTimeline.tsx
│   │       ├── documents/
│   │       │   ├── DocumentViewer.tsx
│   │       │   ├── TriageResults.tsx
│   │       │   └── UploadZone.tsx
│   │       ├── geographic/
│   │       │   ├── GeoAgentEmbed.tsx           # ~500 LOC iframe wrapper
│   │       │   ├── CompactnessChart.tsx
│   │       │   └── DemographicTable.tsx
│   │       ├── research/
│   │       │   ├── PrecedentCard.tsx
│   │       │   ├── CircuitComparison.tsx
│   │       │   └── TimelineView.tsx
│   │       ├── experts/
│   │       │   ├── ExpertCard.tsx
│   │       │   └── TestimonyHistory.tsx
│   │       └── deadlines/
│   │           ├── Calendar.tsx
│   │           └── DeadlineAlert.tsx
│   │
│   ├── stores/
│   │   └── democracy-litigation-store.ts       # Zustand state management
│   │
│   ├── hooks/
│   │   ├── useDemocracyLitigation.ts          # Main data hook
│   │   └── useGeoAgentIntegration.ts          # GeoAgent communication
│   │
│   ├── types/
│   │   └── democracy-litigation.ts            # 1500+ LOC type definitions
│   │
│   └── lib/
│       └── api/
│           ├── democracy-litigation.ts         # API client
│           └── geo-agent.ts                    # GeoAgent API
│
├── package.json
└── tsconfig.json
```

### Backend (Node.js + PostgreSQL)

```
services/
└── api/
    └── src/
        └── democracy-litigation/
            ├── routes/
            │   ├── cases.ts                    # Case management endpoints
            │   ├── documents.ts                # Document endpoints
            │   ├── research.ts                 # VRA research endpoints
            │   ├── geographic.ts               # Geographic analysis
            │   ├── experts.ts                  # Expert witness endpoints
            │   └── deadlines.ts                # Deadline management
            │
            ├── services/
            │   ├── CaseService.ts
            │   ├── DocumentTriageService.ts    # AI document triage
            │   ├── VRAResearchService.ts       # Precedent search
            │   ├── GeographicService.ts        # Census/precinct alignment
            │   ├── ExpertService.ts
            │   └── DeadlineService.ts
            │
            ├── models/
            │   ├── Case.ts
            │   ├── Document.ts
            │   ├── Precedent.ts
            │   ├── ExpertWitness.ts
            │   └── Deadline.ts
            │
            └── utils/
                ├── h3-alignment.ts             # H3 hexagonal grid utilities
                ├── compactness.ts              # Compactness algorithms
                └── citation-parser.ts          # Legal citation parsing
```

---

## Data Flow Architecture

### Document Processing Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Upload     │────►│     OCR      │────►│  Classify    │────►│   Triage     │
│   Document   │     │  Extraction  │     │  Document    │     │  (AI Score)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Attorney   │◄────│   Priority   │◄────│  Privilege   │◄────│  Relevance   │
│   Review     │     │   Queue      │     │  Detection   │     │   Scoring    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### VRA Research Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Research   │────►│  Knowledge   │────►│   Citation   │
│   Query      │     │   Graph      │     │   Network    │
└──────────────┘     └──────────────┘     └──────────────┘
                           │                     │
                           ▼                     ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   Gingles    │     │   Circuit    │
                    │   Analysis   │     │   Mapping    │
                    └──────────────┘     └──────────────┘
                           │                     │
                           └─────────┬───────────┘
                                     ▼
                           ┌──────────────────┐
                           │  Research Report │
                           │  with Citations  │
                           └──────────────────┘
```

### Geographic Analysis Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Census     │────►│     H3       │────►│   Precinct   │
│   Blocks     │     │  Hexagonal   │     │  Alignment   │
└──────────────┘     │    Grid      │     └──────────────┘
                     └──────────────┘            │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Expert     │◄────│   RPV        │◄────│ Compactness  │
│   Report     │     │  Analysis    │     │   Metrics    │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## GeoAgent Integration Architecture

### Design Philosophy: Embedding > Duplication

Rather than duplicating 8000+ lines of GeoAgent code, we use **iframe embedding** with postMessage communication:

```
┌─────────────────────────────────────────────────────────────────┐
│                  Democracy Litigation Dashboard                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    GeoAgentEmbed.tsx                       │  │
│  │                     (~500 LOC)                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                                                      │  │  │
│  │  │              iframe: GeoAgent Dashboard              │  │  │
│  │  │                                                      │  │  │
│  │  │   ┌─────────────────────────────────────────────┐   │  │  │
│  │  │   │  H3 Visualization  │  Compactness Calc     │   │  │  │
│  │  │   │  Census Layers     │  RPV Heatmaps         │   │  │  │
│  │  │   │  District Editor   │  Export Tools         │   │  │  │
│  │  │   └─────────────────────────────────────────────┘   │  │  │
│  │  │                                                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                          ▲                                 │  │
│  │                          │ postMessage API                 │  │
│  │                          ▼                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Event Handlers: onDistrictSelect, onCompactness    │  │  │
│  │  │  Data Injection: districts, census, precincts       │  │  │
│  │  │  Auth: Token via URL parameter                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Benefits

| Approach | Lines of Code | Maintenance |
|----------|---------------|-------------|
| Code Duplication | 8000+ | High drift risk |
| **iframe Embedding** | **~500** | **Zero drift** |

### postMessage Communication Protocol

```typescript
// Events FROM GeoAgent
interface GeoAgentEvent {
  type: 'districtSelected' | 'compactnessCalculated' | 'layerToggled';
  payload: unknown;
}

// Commands TO GeoAgent
interface GeoAgentCommand {
  type: 'loadData' | 'setView' | 'enableWidget';
  payload: unknown;
}
```

---

## Database Architecture

### Schema Design

```
┌─────────────────────────────────────────────────────────────────┐
│                           dl schema                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   cases     │─────►│  documents  │      │  precedents │     │
│  │             │      │             │      │             │     │
│  │ id          │      │ id          │      │ id          │     │
│  │ name        │      │ case_id (FK)│      │ citation    │     │
│  │ case_number │      │ doc_type    │      │ court       │     │
│  │ jurisdiction│      │ content     │      │ gingles_    │     │
│  │ case_type   │      │ relevance   │      │   issues    │     │
│  │ status      │      │ privilege   │      │ holding     │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│         │                                                        │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │  deadlines  │      │   experts   │      │  geographic │     │
│  │             │      │             │      │    _data    │     │
│  │ id          │      │ id          │      │             │     │
│  │ case_id (FK)│      │ name        │      │ case_id (FK)│     │
│  │ deadline_   │      │ specialty   │      │ data_type   │     │
│  │   date      │      │ testimony_  │      │ geojson     │     │
│  │ priority    │      │   count     │      │ h3_index    │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Knowledge Graph (Neo4j)

```
                    ┌─────────────┐
                    │    Case     │
                    │  (node)     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Precedent  │ │   Expert    │ │  Deadline   │
    │   (node)    │ │   (node)    │ │   (node)    │
    └──────┬──────┘ └─────────────┘ └─────────────┘
           │
           │ CITES
           ▼
    ┌─────────────┐
    │  Precedent  │
    │   (node)    │
    └─────────────┘
```

---

## Deployment Architecture

### Kubernetes Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│                        nexus namespace                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            democracy-litigation-api (Deployment)          │   │
│  │                                                           │   │
│  │  Replicas: 2                                              │   │
│  │  CPU: 2000m                                               │   │
│  │  Memory: 4096MB                                           │   │
│  │  Port: 8080                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           democracy-litigation-api (Service)              │   │
│  │                                                           │   │
│  │  Type: ClusterIP                                          │   │
│  │  Port: 8080                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                nexus-postgres (StatefulSet)               │   │
│  │                                                           │   │
│  │  Database: nexus_auth                                     │   │
│  │  Schema: dl                                               │   │
│  │  Storage: 100GB PVC                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Mesh

```
                    ┌─────────────────┐
                    │   API Gateway   │
                    │ (nginx ingress) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Frontend    │  │  Democracy    │  │   GeoAgent    │
│   (Next.js)   │  │  Litigation   │  │   (iframe)    │
│               │  │     API       │  │               │
└───────┬───────┘  └───────┬───────┘  └───────────────┘
        │                  │
        │                  ▼
        │          ┌───────────────┐
        │          │   GraphRAG    │
        │          │     API       │
        │          └───────┬───────┘
        │                  │
        └──────────┬───────┘
                   ▼
           ┌───────────────┐
           │   PostgreSQL  │
           │   + PostGIS   │
           └───────────────┘
```

---

## Security Architecture

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────►│   Auth   │────►│   JWT    │────►│   API    │
│          │     │  Server  │     │  Verify  │     │  Access  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Data Protection

| Layer | Protection |
|-------|------------|
| Transit | TLS 1.3 |
| Storage | AES-256 encryption at rest |
| Database | Row-level security |
| API | Rate limiting, input validation |
| Audit | Complete access logging |

### Sensitive Data Handling

```typescript
// All case data is encrypted at rest
interface EncryptedDocument {
  id: string;
  encryptedContent: string;  // AES-256
  encryptionKeyId: string;   // Key rotation
  metadata: {                // Searchable metadata (not encrypted)
    docType: string;
    caseId: string;
    uploadedAt: Date;
  };
}
```

---

## Scalability Considerations

### Horizontal Scaling

| Component | Scaling Strategy |
|-----------|------------------|
| API | Kubernetes HPA based on CPU/memory |
| Database | Read replicas for research queries |
| Document Storage | S3-compatible object storage |
| AI Processing | Queue-based with worker pools |

### Performance Targets

| Operation | Target Latency |
|-----------|----------------|
| Case list | < 100ms |
| Document triage (per doc) | < 10s |
| VRA research query | < 2s |
| Compactness calculation | < 1s |
| Geographic alignment | < 5min for state |

---

## Monitoring and Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                       Observability Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Prometheus │  │    Loki     │  │   Grafana   │             │
│  │   Metrics   │  │    Logs     │  │  Dashboards │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                          ▼                                       │
│                  ┌───────────────┐                               │
│                  │   Alerting    │                               │
│                  │  (PagerDuty)  │                               │
│                  └───────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Support

- **Architecture Questions:** [GitHub Discussions](https://github.com/adverant/adverant-nexus-democracy-litigation/discussions)
- **Issues:** [GitHub Issues](https://github.com/adverant/adverant-nexus-democracy-litigation/issues)
- **Documentation:** [/docs](./docs)
