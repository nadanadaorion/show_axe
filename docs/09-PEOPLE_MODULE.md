# People module

## Person uniqueness

A person appears only once per Show. The implementation should prevent obvious duplicates by selected Library ID and warn on exact normalized-name duplicates, while still allowing intentional same-name entries when explicitly confirmed.

## Fields

- name;
- company;
- one or more person types;
- one or more roles/functions;
- one or more phone numbers;
- one or more email addresses;
- notes;
- order.

## Add paths

- Copy a person from Library.
- Create freely in the Show.

Library data is copied as a snapshot.

## Editing

Use an expandable row or contextual editor. Secondary contact fields should not dominate the initial list.

## Ordering and search

- Manual ordering is supported.
- Search matches name, company, roles, types, phone, and email.

## Validation

- Name is required.
- Email and phone fields permit real-world formatting and should not use overly strict validation.
- Empty repeated contact fields are removed during normalization.
