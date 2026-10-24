# BlueTodo AI

A desktop-friendly task planner. Describe a goal, review and edit Gemini-generated task suggestions, approve before saving, manage your week, and export dated tasks as an iCalendar (`.ics`) file.

## Start here (Windows)

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. In the BlueToDo project folder, copy `.env.example` to `.env` and open `.env` in a text editor.
3. Replace `paste-your-key-here` with your API key. Do not commit, share, or paste this file into chat. `.env` is ignored by Git.
4. Open PowerShell in the BlueToDo project folder and run `py app.py`.
5. Open `http://127.0.0.1:8000` in a browser. Keep the terminal running while using the app; press Ctrl+C to stop BlueTodo.

If `py app.py` does not work, install Python 3.10+ and try `python app.py`. The backend uses only Python's standard library; no pip installs are needed. By default, requests use `gemini-3.5-flash-lite` with minimal reasoning for faster short plans. Set `GEMINI_MODEL` in `.env` to another model available to your API key if needed. Restart the server after changing `.env`.

Alternatively, set `GEMINI_API_KEY` in the process environment before starting the server. Environment variables take precedence over values in `.env`.

## How it works

- `app.py` serves the static app on loopback only (`127.0.0.1`) and proxies planning requests to Google's Gemini `generateContent` API.
- The app checks Gemini connectivity at startup using a lightweight model-access check; click the status badge to retry and see whether the key/model is accepted.
- The API key is read on the backend from `.env` or the process environment. It is sent to Google in the request header and is never returned to the browser or included in the request URL.
- The assistant receives the current request plus up to 30 saved task summaries for context. These are sent to Google Gemini to generate a plan.
- Gemini returns structured JSON; the backend validates the output and the app shows it as an editable preview. Tasks are persisted only after approval.
- Tasks use browser local storage for the current browser profile and origin. Clearing site data removes them.
- The weekly calendar displays tasks and the download button exports dated tasks as an `.ics` file. There is no direct Google Calendar sync.

## Features

- Today, Upcoming, Calendar, and Completed dashboard views.
- Create, edit, complete, and delete tasks with priority, deadline, and optional duration.
- Gemini-powered planning with an approval gate.
- Browser local-storage persistence and `.ics` calendar export.

## Security and privacy

- Never put the API key in `app.js`, `index.html`, browser storage, or a committed file. The provided `.gitignore` excludes `.env`.
- Keep the local server bound to `127.0.0.1`; it has no authentication and is intended for a trusted single-user computer, not public internet deployment.
- Planner requests and up to 30 task summaries are sent to Google's Gemini API. Review Google's current data-use and API terms before sending sensitive information.
- Tasks themselves remain in browser local storage. Avoid entering sensitive personal information in tasks or planning requests.
- Google Fonts load from Google while online; remove the font links in `index.html` if you do not want that network request.

## Troubleshooting

- **Gemini is not configured:** Check that `.env` exists beside `app.py`, contains `GEMINI_API_KEY=...`, and restart the server.
- **Gemini rejected the API key:** Create or copy a valid key in Google AI Studio, make sure the Gemini API is enabled/available for the project, update `.env`, and restart.
- **Quota or rate limit:** Check the project's Gemini API quota and billing/availability in Google AI Studio.
- **Browser opened with `file://`:** Start `py app.py` and use `http://127.0.0.1:8000`; API requests require the local server.
- **Port 8000 is busy:** Set `BLUETODO_PORT` to an available local port before starting the server.

## Known limitations

- Generated dates, priorities, dependencies, and durations can be wrong. Review every preview before approval.
- The backend validates output shape and field limits, not factual correctness.
- No authentication, cloud backup, Google Calendar OAuth/sync, live event discovery, or public deployment configuration is included.
- Calendar exports use all-day entries; durations are not booked into time slots.

## License

BlueTodo source is under the MIT License; see [LICENSE](LICENSE). DM Sans and Manrope are loaded via Google Fonts when online; consult their licenses if redistributing font files separately.
