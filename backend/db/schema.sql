create extension if not exists pgcrypto;

create table if not exists people (
    id varchar primary key default gen_random_uuid()::text,
    full_name varchar(300) not null,
    created_at timestamp without time zone not null default now()
);

create index if not exists ix_people_full_name
    on people (full_name);

create table if not exists organization_units (
    id varchar primary key default gen_random_uuid()::text,
    parent_id varchar null references organization_units(id) on delete set null,
    unit_type varchar(100) not null,
    name varchar(300) not null,
    display_name varchar(300) null,
    source_name varchar(300) null,
    is_active boolean not null default true,
    created_at timestamp without time zone not null default now(),
    updated_at timestamp without time zone not null default now(),
    constraint ck_organization_units_type
        check (unit_type in ('department', 'division'))
);

create index if not exists ix_organization_units_name
    on organization_units (name);

create index if not exists ix_organization_units_parent_id
    on organization_units (parent_id);

create unique index if not exists ux_organization_units_type_parent_name
    on organization_units (unit_type, coalesce(parent_id, ''), name);

create table if not exists employee_assignments (
    id varchar primary key default gen_random_uuid()::text,
    person_id varchar not null references people(id) on delete restrict,
    is_deleted boolean not null default false,
    created_at timestamp without time zone not null default now()
);

create index if not exists ix_employee_assignments_person_id
    on employee_assignments (person_id);

create index if not exists ix_employee_assignments_is_deleted
    on employee_assignments (is_deleted);

create table if not exists assignment_versions (
    id varchar primary key default gen_random_uuid()::text,
    assignment_id varchar not null references employee_assignments(id) on delete cascade,
    department_id varchar null references organization_units(id) on delete set null,
    division_id varchar null references organization_units(id) on delete set null,
    manager_person_id varchar null references people(id) on delete set null,
    position_name varchar(300) not null,
    status varchar(100) not null,
    employment_type varchar(100) not null,
    hire_date date not null,
    termination_date date null,
    salary numeric(12, 2) null,
    effective_from date not null,
    effective_to date null,
    is_current boolean not null default true,
    constraint ck_assignment_versions_salary
        check (salary is null or salary >= 0),
    constraint ck_assignment_versions_hire_termination
        check (termination_date is null or termination_date >= hire_date),
    constraint ck_assignment_versions_effective_range
        check (effective_to is null or effective_to >= effective_from)
);

create index if not exists ix_assignment_versions_assignment_id
    on assignment_versions (assignment_id);

create index if not exists ix_assignment_versions_department_id
    on assignment_versions (department_id);

create index if not exists ix_assignment_versions_division_id
    on assignment_versions (division_id);

create index if not exists ix_assignment_versions_manager_person_id
    on assignment_versions (manager_person_id);

create index if not exists ix_assignment_versions_status
    on assignment_versions (status);

create index if not exists ix_assignment_versions_relevance
    on assignment_versions (effective_from, effective_to, is_current);

create unique index if not exists ux_assignment_versions_one_current
    on assignment_versions (assignment_id)
    where is_current = true;

create table if not exists import_batches (
    id varchar primary key default gen_random_uuid()::text,
    original_filename varchar(500) not null,
    stored_filename varchar(500) not null,
    file_sha256 varchar(64) not null,
    source_sheet_name varchar(200) not null,
    source_cutoff_date date null,
    import_mode varchar(50) not null default 'upsert_current',
    status varchar(50) not null default 'pending',
    total_rows integer not null default 0,
    processed_rows integer not null default 0,
    inserted_rows integer not null default 0,
    updated_rows integer not null default 0,
    unchanged_rows integer not null default 0,
    warning_count integer not null default 0,
    error_count integer not null default 0,
    options jsonb not null default '{}'::jsonb,
    started_at timestamp without time zone null,
    completed_at timestamp without time zone null,
    created_at timestamp without time zone not null default now(),
    created_by varchar(200) null,
    constraint ck_import_batches_status
        check (status in ('pending', 'running', 'completed', 'completed_with_warnings', 'failed')),
    constraint ck_import_batches_counts
        check (
            total_rows >= 0
            and processed_rows >= 0
            and inserted_rows >= 0
            and updated_rows >= 0
            and unchanged_rows >= 0
            and warning_count >= 0
            and error_count >= 0
        )
);

create index if not exists ix_import_batches_created_at
    on import_batches (created_at desc);

create index if not exists ix_import_batches_status
    on import_batches (status);

create table if not exists export_operations (
    id varchar primary key default gen_random_uuid()::text,
    requested_by varchar(200) null,
    export_type varchar(50) not null default 'manual',
    filters jsonb not null default '{}'::jsonb,
    status varchar(50) not null default 'pending',
    file_path varchar(1000) null,
    total_rows integer not null default 0,
    processed_rows integer not null default 0,
    started_at timestamp without time zone null,
    completed_at timestamp without time zone null,
    created_at timestamp without time zone not null default now(),
    constraint ck_export_operations_status
        check (status in ('pending', 'running', 'completed', 'completed_with_warnings', 'failed')),
    constraint ck_export_operations_counts
        check (total_rows >= 0 and processed_rows >= 0)
);

create index if not exists ix_export_operations_created_at
    on export_operations (created_at desc);

create index if not exists ix_export_operations_status
    on export_operations (status);

create table if not exists operation_events (
    id integer generated by default as identity primary key,
    action_type varchar(20) not null,
    operation_id varchar not null,
    level varchar(20) not null default 'info',
    status varchar(50) not null,
    message text null,
    payload jsonb not null default '{}'::jsonb,
    processed_rows integer null,
    total_rows integer null,
    created_at timestamp without time zone not null default now(),
    constraint ck_operation_events_action_type
        check (action_type in ('import', 'export')),
    constraint ck_operation_events_level
        check (level in ('info', 'warning', 'error')),
    constraint ck_operation_events_status
        check (status in ('pending', 'running', 'completed', 'completed_with_warnings', 'failed')),
    constraint ck_operation_events_counts
        check (
            (processed_rows is null or processed_rows >= 0)
            and (total_rows is null or total_rows >= 0)
        )
);

create index if not exists ix_operation_events_operation
    on operation_events (action_type, operation_id, id);

create index if not exists ix_operation_events_created_at
    on operation_events (created_at);
