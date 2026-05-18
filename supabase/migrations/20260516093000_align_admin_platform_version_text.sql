-- Align the Admin console release marker with the same semantic-version
-- convention now used by the mobile platform rows.
--
-- This keeps the numeric build field intact while storing the marketing
-- version as text (for example: 0.1.0, 1.0.2, 1.0.3).

update platform.control
set version = '0.1.0'
where lower("group") in ('admin', 'web_admin', 'webapp', 'web_admin_console');
