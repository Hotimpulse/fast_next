create extension if not exists pgcrypto;
create extension if not exists citext;


create table if not exists department (
    id uuid primary key default gen_random_uuid(),
    dept_name text not null
)

create table if not exists division (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    division_name text
)

create table if not exists employees (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    department text not null,
    division text,
    job_title text not null,
    manager_name text,
    employee_name not null,
    job_start_date date not null,
    job_termination_date date,
    job_status text not null,
    hired_status text not null,
    salary number not null not null,
)
