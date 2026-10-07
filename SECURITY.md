# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for them.

Include what you found, how to reproduce it, and what an attacker could do with it. You should get a first reply within a week.

## What is in scope

- The hosted app at https://utilitylab-ten.vercel.app and this repository.
- In particular the LimeSurvey push route (`app/api/limesurvey/push`), which passes a researcher's LimeSurvey credentials to their server and never stores them.

Studies are stored only in the user's browser; the app has no accounts or database.

## Supported versions

Fixes go into the latest release. Self-hosted copies should update to it.
