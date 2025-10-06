1. Seeding Test Data
Creates dummy users and orders for testing.

Includes both recent and old (stale) orders.

Uses batching for fast bulk inserts.

Prepares realistic data for migration validation.



2. CRON Setup

Automates migration daily (e.g., 2:00 AM).

Redirects logs to a file for tracking.

Runs silently in the background.

Keeps live data clean and performance optimized.


CLI script usage:
Run scripts using Node.js from the terminal.

Seeding script: generates test data.

Migration script: moves stale orders to archive.

Supports flags like dry run or limited users.

Used for manual testing before automation.


CRON Job Configuration

Automates migration at a fixed time daily (e.g., 2 AM).

Runs in the background without manual action.( for this need to insall the:   npm install -g pm2
                                                                              pm2 start npm --name "migration-cron" -- run start:cron)

Logs output to a file for tracking.

Ensures continuous, scheduled data migration.
