# CONCIERTA — Diagramas técnicos

**Proyecto:** Sistema académico de gestión de reservas de conciertos  
**Alcance:** arquitectura de microservicios, modelo de datos y principales flujos  
**Formato:** Mermaid (compatible con la vista previa Markdown de GitHub y editores compatibles).

> Estos diagramas describen la implementación revisada de CONCIERTA. Cada microservicio posee una base de datos PostgreSQL independiente. Las referencias entre bases son identificadores lógicos, no claves foráneas físicas.

## 1. Arquitectura general de microservicios

```mermaid
flowchart TB
    C[Cliente / Administrador] --> W[Frontend React + Vite<br/>localhost:5173]
    W -->|Registro, sesión, usuarios, roles| A[Autenticación<br/>FastAPI · puerto 8001]
    W -->|Cartelera, escenario, gestión, reportes| E[Eventos<br/>Express + Sequelize · puerto 8002]
    W -->|Reservas, disponibilidad, PDFs, QR| R[Reservas<br/>FastAPI · puerto 8003]

    E -->|Verifica usuario y rol mediante clave interna| A
    R -->|Verifica usuario, rol y datos para correo| A
    R -->|Consulta eventos, secciones y asientos| E
    E -->|Consulta reporte agregado mediante clave interna| R

    A --> DA[(PostgreSQL<br/>concierta_auth)]
    E --> DE[(PostgreSQL<br/>concierta_events)]
    R --> DR[(PostgreSQL<br/>concierta_reservations)]

    A -->|SMTP: credenciales temporales| M[Servidor SMTP]
    R -->|SMTP: confirmación y PDFs adjuntos| M

    subgraph Entorno_local
      A
      E
      R
      DA
      DE
      DR
    end
```

**Notas:**
- PostgreSQL se ejecuta en Docker; los servicios y el frontend se ejecutan localmente. El puerto PostgreSQL publicado en Windows es `5434`.
- Autenticación emite JWT; Eventos y Reservas verifican además el estado y el rol actuales del usuario mediante el endpoint interno de Auth.
- La validación QR la ejecuta un administrador; el pago es **simulado**.

## 2. Modelo entidad–relación por microservicio

### 2.1 Autenticación — `concierta_auth`

```mermaid
erDiagram
    ROLES ||--o{ USERS : asigna
    ROLES {
        string id PK
        string description
    }
    USERS {
        string id PK
        string first_name
        string second_name
        string last_name
        string dni UK
        string nationality
        string address
        string phone
        string email UK
        string username UK
        string password_hash
        string role_id FK
        boolean active
        datetime last_login
        datetime created_at
        boolean must_change_password
        datetime password_changed_at
        int token_version
    }
    AUDIT_LOGS_AUTH {
        string id PK
        string user_id
        string action
        string resource
        string resource_id
        string status
        string details
        datetime created_at
    }
```

**Nota:** `AUDIT_LOGS_AUTH.user_id` almacena el identificador del actor; el código no define una relación `ForeignKey` desde esa columna hacia `users`.

### 2.2 Eventos — `concierta_events`

```mermaid
erDiagram
    SCENARIOS ||--o{ SECTIONS : contiene
    SECTIONS ||--o{ ROWS : agrupa
    ROWS ||--o{ SEATS : contiene
    SECTIONS ||--o{ SEATS : clasifica
    SCENARIOS ||--o{ EVENTS : alberga

    SCENARIOS {
        int id PK
        string name
        string description
        string location
        int capacity
    }
    SECTIONS {
        int id PK
        int scenarioId FK
        string name
        string type
        int capacity
        decimal price
        int rows
        int seatsPerRow
    }
    ROWS {
        int id PK
        int sectionId FK
        string label
        int position
    }
    SEATS {
        int id PK
        int sectionId FK
        int rowId FK
        string rowLabel
        int number
        string label
    }
    EVENTS {
        uuid id PK
        int scenarioId FK
        string name
        string description
        string artist
        string genre
        datetime date
        string imageUrl
        boolean active
    }
    AUDIT_LOGS_EVENTS {
        uuid id PK
        string userId
        string action
        string resource
        string resourceId
        string status
        string details
    }
```

**Nota:** el servicio define el modelo `AuditLog` con nombre de tabla gestionado por Sequelize; los campos de auditoría se muestran para documentar su propósito. La entidad `ROW` representa las filas físicas del escenario; el atributo `sections.rows` almacena la cantidad de filas.

### 2.3 Reservas — `concierta_reservations`

```mermaid
erDiagram
    RESERVATIONS ||--|{ TICKETS : contiene
    RESERVATIONS {
        string id PK
        string code UK
        string client_id
        string event_id
        string status
        datetime created_at
        datetime expires_at
        datetime confirmed_at
        decimal total
        string email_status
    }
    TICKETS {
        string id PK
        string reservation_id FK
        string event_id
        int section_id
        int seat_id
        string seat_label
        string qr_secret UK
        decimal unit_price
        datetime validated_at
    }
    AUDIT_LOGS_RESERVATIONS {
        string id PK
        string user_id
        string action
        string resource
        string resource_id
        string status
        string details
        datetime created_at
    }
```

**Referencias lógicas entre microservicios:**
- `reservations.client_id` corresponde a `auth.users.id`.
- `reservations.event_id` y `tickets.event_id` corresponden a `events.events.id`.
- `tickets.section_id` y `tickets.seat_id` hacen referencia a las localidades del servicio Eventos.
- No existen claves foráneas SQL entre bases de datos independientes.
- Un ticket de CANCHA puede no tener `seat_id`, al tratarse de una localidad no numerada.

## 3. Flujo de reserva y confirmación

```mermaid
sequenceDiagram
    autonumber
    actor Cliente
    participant Web as React (5173)
    participant Auth as Auth (8001)
    participant Eventos as Eventos (8002)
    participant Reservas as Reservas (8003)
    participant BD as PostgreSQL Reservas
    participant SMTP as Servidor SMTP

    Cliente->>Web: Inicia sesión
    Web->>Auth: POST /auth/login
    Auth-->>Web: JWT y datos básicos
    Cliente->>Web: Elige concierto y localidades
    Web->>Eventos: GET /events y GET /scenario
    Eventos-->>Web: Cartelera, secciones y asientos
    Web->>Reservas: GET /availability/{event_id}
    Reservas->>Eventos: Verifica concierto y escenario
    Reservas->>BD: Consulta confirmadas y pendientes vigentes
    Reservas-->>Web: Asientos ocupados y cupos
    Cliente->>Web: Solicita reserva (hasta 6 entradas)
    Web->>Reservas: POST /reservations (JWT, items)
    Reservas->>Auth: Verifica sesión, rol y cuenta actual
    Reservas->>BD: Bloqueo por evento, verifica cupos y crea PENDING
    Reservas-->>Web: Código, boletos y vencimiento
    Cliente->>Web: Confirma pago simulado antes de expirar
    Web->>Reservas: POST /reservations/{id}/confirm
    Reservas->>BD: Cambia estado a CONFIRMED
    Reservas-->>Web: Reserva confirmada
    Reservas->>Auth: Consulta correo y nombre del cliente
    Reservas->>Eventos: Consulta datos del concierto
    Reservas->>SMTP: Correo con PDF resumen y PDFs individuales
    alt Envío correcto
        Reservas->>BD: email_status = SENT
    else Envío fallido
        Reservas->>BD: email_status = FAILED
        Note over Cliente,Reservas: El cliente puede solicitar reenvío
    end
```

**Reglas:**
- El apartado dura normalmente cinco minutos (`HOLD_MINUTES`). Las pendientes vencidas pasan a `EXPIRED` y liberan localidades.
- PostgreSQL serializa solicitudes competidoras del mismo evento con un bloqueo transaccional.
- La confirmación de pago no procesa dinero ni datos bancarios reales.
- Los boletos confirmados permiten descargar un PDF general y un PDF individual por entrada.

## 4. Flujo de validación de boleto QR

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador de acceso
    participant Web as Panel React
    participant Auth as Autenticación
    participant Reservas as Reservas
    participant BD as PostgreSQL Reservas

    Admin->>Web: Escanea QR o introduce su contenido
    Note over Web: Payload: CONCIERTA:ticket_id:qr_secret
    Web->>Reservas: POST /tickets/{tid}/validate con qr_secret y JWT
    Reservas->>Auth: Verifica cuenta, sesión y rol actual
    alt No es ADMIN
        Reservas-->>Web: 403 — Acceso denegado
    else Administrador válido
        Reservas->>BD: Consulta boleto y reserva
        alt QR incorrecto o reserva no confirmada
            Reservas-->>Web: 400 — Ticket inválido
        else Boleto ya validado
            Reservas-->>Web: 409 — Ticket ya utilizado
        else Entrada válida
            Reservas->>BD: Guarda validated_at y auditoría
            Reservas-->>Web: 200 — valid: true
        end
    end
```

> **Alcance de seguridad:** el endpoint comprueba el rol, el secreto del boleto, la confirmación de la reserva y la ausencia de una validación anterior. Para despliegue comercial de alto tráfico, conviene reforzar la atomicidad de validaciones concurrentes del mismo QR mediante bloqueo o actualización condicional.

## 5. Puertos y recursos

| Componente | Dirección local | Persistencia |
|---|---|---|
| Frontend | `http://localhost:5173` | — |
| Autenticación | `http://localhost:8001` | `concierta_auth` |
| Eventos | `http://localhost:8002` | `concierta_events` |
| Reservas | `http://localhost:8003` | `concierta_reservations` |
| PostgreSQL Docker | `localhost:5434` | Tres bases independientes |

**Documentación interactiva FastAPI:** `http://localhost:8001/docs` y `http://localhost:8003/docs`. Eventos no incluye Swagger en la versión revisada.
