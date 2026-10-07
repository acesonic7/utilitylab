# Contributing to UtilityLab

Thanks for helping. Bug reports, design feedback from people running stated choice experiments, and pull requests are all welcome.

## Reporting a problem

Open an issue with the **Bug report** template. A downloaded project file (**Studies → Download**) makes most problems reproducible in minutes; remove anything confidential first.

For security problems see [SECURITY.md](SECURITY.md) instead.

## Setting up

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npx tsc --noEmit   # type check
npm run build      # production build
```

CI runs the type check, the tests and the build on every pull request, and a pull request needs a green CI to merge.

The LimeSurvey exports have an end-to-end check against a real LimeSurvey in Docker; see [scripts/limesurvey-e2e](scripts/limesurvey-e2e/README.md). Run it when you change `lib/limesurveyExport.ts` or the push route.

## Pull requests

- Keep each pull request to one change, with a test for any change to `lib/`.
- Say in the description how you checked it, especially for export formats.
- For larger features, open an issue first so we can agree the approach.

## Vocabulary

UtilityLab follows the stated choice terminology of Ben-Akiva, Walker and colleagues, verbatim: *stated choice experiment*, *choice task* (never just "task"), *alternative*, *attribute*, *level*, *block*, *respondent*, *context variable*. Please use the same words in the interface, messages and docs.

## Licence

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
