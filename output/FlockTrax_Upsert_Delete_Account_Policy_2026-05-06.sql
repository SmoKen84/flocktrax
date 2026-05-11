insert into platform.license_policy (
  name,
  display_txt,
  note,
  scrn_location
)
values (
  'delete_account',
  $policy$
FlockTrax Account Deletion

Last updated: May 6, 2026

FlockTrax-MOBILE supports account deletion through the app for accounts and environments where self-service deletion is enabled.

Delete Your Account In the App

1. Sign in to FlockTrax-MOBILE.
2. Open the main dashboard.
3. Tap Delete Account.
4. Type DELETE to confirm.
5. Submit the deletion request.

After a successful deletion request, the app clears the current session and returns you to the login screen.

If You Cannot Access the App

If you are unable to sign in or cannot complete deletion inside the app, contact FlockTrax support and request account deletion assistance.

Email: Ken@MotherCluckersHenHouse.com
Phone: (254) 715-6101
Mail: Smotherman Farms, Ltd., 1379 Patton Branch Rd, West, TX 76691-2411

Important Note

Certain information may be retained where necessary for security, fraud prevention, recordkeeping, legal compliance, or other permitted business purposes.

For more information about how FlockTrax handles data, see the FlockTrax Privacy Policy.
$policy$,
  'delete account support',
  'public support page'
)
on conflict (name) do update
set
  display_txt = excluded.display_txt,
  note = excluded.note,
  scrn_location = excluded.scrn_location,
  updated_at = now();
