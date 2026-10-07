# LimeSurvey end-to-end check

Imports UtilityLab's LimeSurvey exports into a real LimeSurvey 6 (Docker), then takes each
survey as 20 simulated respondents and checks, from the exported responses, that:

- every respondent saw exactly one block, recorded as `BLK`;
- every choice task has its answer texts;
- labels that look like Expression Manager, Qualtrics or HTML syntax are shown literally;
- the study's question text is shown.

It covers the LSS file import and the API push (`/api/limesurvey/push`).

```bash
LIMESURVEY_PUSH_ALLOW_PRIVATE=1 npx next dev -p 3005   # in another terminal, for the push
scripts/limesurvey-e2e/run.sh            # import + push; or: run.sh import
docker compose -p lstest down -v         # remove the stack and its data
```

Test credentials are generated into `out/.env.test`, which is git-ignored.
