# TaskMate Privacy Policy

Last updated: 2026-11-10

This Privacy Policy explains how TaskMate Mobile ("TaskMate", "the app") handles user data. TaskMate is provided by Ke-san0705.

TaskMate is a local-first task management and focus support app. It helps users choose what to work on now, start a focus session, and return to TaskMate when they open apps they selected as distracting during that session. TaskMate may also help users unlock selected apps after they spend a user-defined amount of time in selected requirement apps.

## Data Stored On Your Device

TaskMate stores the following information locally on your device:

- Tasks, including title, description, due date/time, completion status, and timestamps.
- Focus session state, including the selected task, start/end times, completion/interruption status, and selected blocked apps.
- App restriction settings, including app names and package names selected by the user.
- Unlock Mode settings, including required minutes, requirement app names/package names, blocked app names/package names, and local same-day usage progress derived on the device.
- App settings, including notification settings, quiet hours, reduced motion, selected character, and custom character settings.
- Widget state derived from tasks and focus session data.

Existing local tasks and focus data are not uploaded. The optional external task inbox described below receives new tasks from a service you connect.

## App Restriction And Accessibility Service

TaskMate includes an optional app restriction feature for focus sessions and Unlock Mode. If the user enables this feature, TaskMate uses the Android Accessibility Service API only while a focus session is active, or while Unlock Mode is enabled and the user-defined daily condition has not yet been reached.

TaskMate uses Accessibility Service events to detect when an app selected by the user as a blocked app appears in the foreground. When this happens, TaskMate can guide the user back to TaskMate and show a focus reminder.

TaskMate does not use the Accessibility Service to read or collect:

- Screen contents.
- Typed text or keyboard input.
- Messages, SNS content, or chat contents.
- Browser history or web page contents.
- Photos, videos, or media files.
- Call history.
- Contacts.
- Location.

Foreground app information used for app restriction is processed locally on the device and is not sent to a TaskMate server or shared with third parties.

Before the user is sent to Android Accessibility settings, TaskMate displays an in-app disclosure explaining what data is accessed, how it is used, and that it is not shared externally. The app restriction feature is optional; users can still use task management and normal focus screens without enabling Accessibility Service.

## Unlock Mode And Usage Access

TaskMate includes an optional Unlock Mode. In this mode, users choose requirement apps, a required usage time, and apps to keep restricted until the requirement is reached.

If the user enables Unlock Mode, TaskMate uses Android Usage Access through `UsageStatsManager` to calculate the total foreground usage time of only the user-selected requirement apps for the current local day. For example, if a user selects Duolingo and a vocabulary app as requirement apps, TaskMate checks the combined usage time of those apps to determine whether selected entertainment apps should be unlocked for that day.

TaskMate does not use Usage Access to read or collect:

- Screen contents.
- Typed text or keyboard input.
- Messages, SNS content, or chat contents.
- Browser history or web page contents.
- Photos, videos, or media files.
- Call history.
- Contacts.
- Location.

Usage duration and Unlock Mode decisions are processed locally on the device and are not sent to a TaskMate server or shared with third parties.

Before the user is sent to Android Usage Access settings, TaskMate displays an in-app disclosure explaining what usage information is accessed, how it is used, and that it is not shared externally. Unlock Mode is optional.

## Notifications

TaskMate may request notification permission to provide deadline reminders and focus-related reminders. Notifications are generated for app functionality and do not require sending task or focus data to an external server.

## Device Restart And Widget Updates

TaskMate may use device boot events to restore focus state and refresh home screen widgets after the device restarts. This processing is local to the device.

## Custom Character Images

If the user chooses a custom character image, TaskMate may request access to the system photo picker or photo library only for selecting that image. TaskMate does not upload photos or media files to a server.

## Network And Third-Party Services

Core task management does not require an account. The optional external task inbox uses Supabase Auth and a Supabase-hosted API/database. When you enable it, TaskMate authenticates your account and downloads tasks sent by your connected service, such as Muse. TaskMate does not upload your existing local tasks or use advertising, in-app purchases, AI/LLM inference, or analytics tracking.

The inbox stores your account identifier, integration-key hashes, source task identifiers, task title, description, date/time, genre, priority, and receipt status. TaskMate sends receipt acknowledgements after local storage succeeds. Authentication sessions are stored in the device's SecureStore. Only you and services holding your issued integration key can add to your inbox; that key cannot read, edit or delete your tasks. Muse and Supabase have their own privacy policies. Focus, Accessibility, Usage Access, Unlock Mode, widget data, and character images are not sent through this integration.

## Data Sharing And Sale

TaskMate does not sell user data.

If you connect the external task inbox, the tasks you send through that connection are processed by Supabase to deliver them to your device. TaskMate does not share focus data, selected blocked app data, Accessibility event data, Usage Access data, Unlock Mode data, photos, contacts, location, or messages through the inbox.

## Data Retention And Deletion

TaskMate stores data locally until the user deletes it or uninstalls the app.

Users can delete local TaskMate data from the app's settings screen. Deleting local data removes locally stored tasks, settings, focus session data, focus history, Unlock Mode settings, and character settings from the device. Uninstalling the app also removes app-local data according to Android system behavior.

Logging out or deleting local data does not delete the server inbox or revoke its integration keys. Imported tasks remain on the device after logout or account switching. You can revoke individual keys or delete all server integration data from the external task settings. Task bodies are removed from the server after receipt acknowledgement; source identifiers, input fingerprints and receipt status remain to prevent duplicate imports. Pending tasks and duplicate-prevention records remain until you delete integration data or the associated account. Account deletion removes related inbox data; contact the developer for account deletion. The app does not create new accounts.

## Children

TaskMate is not designed as an app directed primarily to children under 13. If a child uses TaskMate, a parent or guardian should review the app and this Privacy Policy.

## Security

TaskMate keeps its core data local to the device. Optional inbox connections use HTTPS, account-based access rules, and hashed integration keys. Google Play Data Safety information must reflect this optional online feature before its release.

## Changes To This Policy

This Privacy Policy may be updated when TaskMate changes how it handles data. The "Last updated" date will be revised when the policy changes.

## Contact

For privacy inquiries, please use the developer contact information shown on the Google Play store listing for TaskMate Mobile, or any public contact address or form later provided by the developer for TaskMate.
