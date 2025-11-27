# Discord School Bot

A simple Discord bot for Hwahong High School that:

- Automatically assigns a role to new members when they join the server.
- Fetches the daily **timetable** (`hisTimetable`) and **lunch menu** (`mealServiceDietInfo`) from NEIS Open API.
- Sends the timetable and lunch menu to a designated channel in **Embed format** every weekday at 8:30 AM.

## Features

- Auto-role assignment on member join
- Daily timetable and lunch notifications
- Embed messages for clean display
- PM2 compatible for stable deployment
