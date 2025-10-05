create table counters
(
    id         INTEGER
        primary key autoincrement,
    label      TEXT,
    value      INTEGER,
    session_id TEXT,
    unique (label, session_id)
);

create index idx_counters_label
    on counters (label);

create table dialogue
(
    id        INTEGER
        primary key autoincrement,
    speaker   TEXT not null,
    text      TEXT not null,
    timestamp REAL default (julianday('now'))
);

create index idx_dialogue_speaker
    on dialogue (speaker);

create table errors
(
    id         INTEGER
        primary key autoincrement,
    label      TEXT,
    value      INTEGER,
    session_id TEXT,
    unique (label, session_id)
);

create index idx_errors_label
    on errors (label);

create table events
(
    id                          INTEGER
        primary key autoincrement,
    event_type                  TEXT not null,
    event_data                  TEXT not null,
    location                    TEXT,
    game_time                   REAL,
    game_time_str               TEXT,
    local_time                  REAL   default (julianday('now')),
    actor_UUIDs                 TEXT,
    originating_actor_UUID      BIGINT default 0,
    target_actor_UUID           BIGINT default 0,
    memory_generated_for_actors TEXT   default '[]'
);

create index idx_events_local_time
    on events (local_time);

create index idx_events_memory_generated_actors
    on events (memory_generated_for_actors);

create index idx_events_originating_actor
    on events (originating_actor_UUID);

create index idx_events_target_actor
    on events (target_actor_UUID);

create index idx_events_type
    on events (event_type);

create table memories
(
    id                 INTEGER
        primary key autoincrement,
    actor_uuid         BIGINT not null,
    content            TEXT   not null,
    location           TEXT,
    game_time          REAL,
    creation_time      REAL default (julianday('now')),
    related_event_ids  TEXT,
    related_actors     TEXT,
    emotion            TEXT,
    importance_score   REAL default 0.5,
    tags               TEXT,
    memory_type        TEXT default 'EXPERIENCE',
    embedding_checksum TEXT
);

create index idx_memories_actor
    on memories (actor_uuid);

create index idx_memories_creation_time
    on memories (creation_time desc);

create index idx_memories_emotion
    on memories (emotion);

create index idx_memories_game_time
    on memories (game_time);

create index idx_memories_importance
    on memories (importance_score desc);

create index idx_memories_location
    on memories (location);

create index idx_memories_type
    on memories (memory_type);

create table memory_embeddings
(
    memory_id INTEGER
        primary key
        references memories
            on delete cascade,
    embedding BLOB    not null,
    dimension INTEGER not null
);

create index idx_memory_embeddings_dimension
    on memory_embeddings (dimension);

create table schema_migrations
(
    version INTEGER
        primary key
);

create table traces
(
    id           INTEGER
        primary key autoincrement,
    timestamp    REAL,
    depth        INTEGER,
    label        TEXT,
    duration_us  REAL,
    parent_label TEXT,
    session_id   TEXT
);

create index idx_traces_label
    on traces (label);

create index idx_traces_session
    on traces (session_id);

create table uuid_mappings
(
    id                INTEGER
        primary key autoincrement,
    uuid              BIGINT  not null
        unique,
    form_id           INTEGER not null,
    actor_name        TEXT,
    bio_template_name TEXT,
    created_at        REAL default (julianday('now')),
    updated_at        REAL default (julianday('now'))
);

create index idx_uuid_mappings_actor_name
    on uuid_mappings (actor_name);

create index idx_uuid_mappings_bio_template
    on uuid_mappings (bio_template_name);

create index idx_uuid_mappings_form_id
    on uuid_mappings (form_id);

create index idx_uuid_mappings_uuid
    on uuid_mappings (uuid);

