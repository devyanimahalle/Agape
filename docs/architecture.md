# SharePlate Architecture

## Overview

SharePlate is a food surplus redistribution platform that connects food providers (restaurants, caterers, event organizers) with verified NGOs to minimize food waste and feed communities in need. The platform features role-based access control, document verification workflows, geocoded food listing discovery, and comprehensive impact tracking.

## System Architecture

```mermaid
flowchart TD
    subgraph Users["User Roles"]
        Admin["🔑 Admin"]
        Provider["🍽️ Provider"]
        NGO["🏢 NGO"]
    end

    subgraph Frontend["Frontend Container (Nginx)"]
        Nginx["Nginx Reverse Proxy\nPort 80"]
        SPA["React SPA\nVite + Tailwind CSS"]
    end

    subgraph Backend["Backend Container"]
        API["FastAPI Application\nPort 8000"]
        Auth["JWT Authentication"]
        Routes["API Routes\n/api/v1/*"]
    end

    subgraph Database["Database Container"]
        PG["PostgreSQL 16\nPort 5432"]
    end

    subgraph Storage["Docker Volumes"]
        PrivateDocs["📁 Private Documents\n/app/storage/private\nRegistration docs, IDs"]
        ProofDocs["📁 Proof Storage\n/app/storage/proofs\nCompletion proofs"]
    end

    Admin -->|"Manage users\nVerify NGOs\nView impact"| Nginx
    Provider -->|"Create listings\nManage surplus"| Nginx
    NGO -->|"Browse listings\nReserve food\nSubmit proofs"| Nginx

    Nginx -->|"Static files"| SPA
    Nginx -->|"Proxy /api/*"| API

    API --> Auth
    API --> Routes
    Routes --> PG
    Routes -->|"Upload/read docs"| PrivateDocs
    Routes -->|"Upload/read proofs"| ProofDocs

    PG -->|"pgdata volume"| PGData["📁 pgdata\nPersistent DB storage"]
```

## User Roles & Features

```mermaid
flowchart LR
    subgraph AdminFeatures["Admin Features"]
        A1["User Management"]
        A2["NGO Verification"]
        A3["Impact Dashboard"]
        A4["System Oversight"]
    end

    subgraph ProviderFeatures["Provider Features"]
        P1["Register & Login"]
        P2["Create Food Listings"]
        P3["Set Quantity & Expiry"]
        P4["Track Reservations"]
    end

    subgraph NGOFeatures["NGO Features"]
        N1["Register with Documents"]
        N2["Browse Available Food"]
        N3["Reserve Listings"]
        N4["Submit Completion Proofs"]
    end

    Admin["🔑 Admin"] --> AdminFeatures
    Provider["🍽️ Provider"] --> ProviderFeatures
    NGO["🏢 NGO"] --> NGOFeatures
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | Single Page Application |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Routing** | React Router v6 | Client-side routing |
| **Backend** | Python FastAPI | REST API framework |
| **ORM** | SQLAlchemy | Database abstraction |
| **Database** | PostgreSQL 16 | Relational data storage |
| **Auth** | JWT (python-jose) | Stateless authentication |
| **Containerization** | Docker + Compose | Service orchestration |
| **CI/CD** | GitHub Actions | Automated testing & deployment |
| **Registry** | GitHub Container Registry | Docker image hosting |
| **Reverse Proxy** | Nginx | Static serving + API proxy |
| **Deployment** | Render | Cloud hosting platform |

## Data Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant N as Nginx
    participant F as React SPA
    participant B as FastAPI
    participant D as PostgreSQL
    participant S as File Storage

    U->>N: HTTP Request
    alt Static Asset
        N->>F: Serve static file
        F-->>U: HTML/JS/CSS
    else API Request (/api/*)
        N->>B: Proxy request
        B->>B: JWT Validation
        alt Auth Failed
            B-->>N: 401 Unauthorized
            N-->>U: Error response
        else Auth OK
            B->>D: Query/Mutation
            D-->>B: Result
            opt File Operation
                B->>S: Read/Write document
                S-->>B: File data
            end
            B-->>N: JSON response
            N-->>U: API response
        end
    end
```

## Food Listing Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Provider creates listing
    Created --> Available: Listing published
    Available --> Reserved: NGO reserves
    Reserved --> Completed: NGO submits proof
    Reserved --> Available: Reservation cancelled
    Completed --> [*]: Food redistributed

    note right of Available: Visible on NGO board\nFiltered by location
    note right of Reserved: Quantity decremented\nProvider notified
    note right of Completed: Proof uploaded\nImpact metrics updated
```

## Security Considerations

| Concern | Implementation |
|---------|---------------|
| **Authentication** | JWT tokens with expiration, issued on login |
| **Authorization** | Role-based access control (Admin, Provider, NGO) |
| **Password Storage** | bcrypt hashing via passlib |
| **File Storage** | Private Docker volumes, not publicly accessible |
| **PII Protection** | Masked Aadhaar/PAN display (last 4 digits only) |
| **CORS** | Configurable allowed origins via environment variable |
| **Security Headers** | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection via Nginx |
| **Non-root Container** | Backend runs as unprivileged `app` user |
| **Secrets Management** | Environment variables, never committed to source |

## Deployment Architecture

```mermaid
flowchart LR
    subgraph GitHub["GitHub"]
        Repo["devyanimahalle/Agape"]
        Actions["GitHub Actions"]
        GHCR["GitHub Container Registry"]
    end

    subgraph Render["Render Cloud"]
        RenderBackend["Backend Service"]
        RenderFrontend["Frontend Service"]
        RenderDB["PostgreSQL"]
    end

    subgraph Local["Local Fallback"]
        Compose["docker compose up"]
    end

    Repo -->|"Push to main"| Actions
    Actions -->|"Build & push images"| GHCR
    Actions -->|"Deploy hooks"| Render
    GHCR -->|"Pull images"| RenderBackend
    GHCR -->|"Pull images"| RenderFrontend
    GHCR -.->|"Pull images"| Compose
```
