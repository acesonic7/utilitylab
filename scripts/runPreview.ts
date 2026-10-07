import { mkdirSync, writeFileSync } from 'node:fs'
import { travelModeExample } from '../lib/example'
import { renderTaskAsHtml } from '../lib/qualtricsExport'

const project = travelModeExample
const rows = project.design?.rows ?? []

const tasksHtml = rows
  .map(
    (row) => `
  <section>
    <h2>Task ${row.taskId} (Block ${row.block})</h2>
    ${renderTaskAsHtml(project, row)}
    <p><em>Which option would you choose?</em></p>
    <ul>
      ${project.builder.alternativeOrder
        .map((id) => project.alternatives.find((a) => a.id === id))
        .filter((a) => !!a)
        .map((a) => `<li><label><input type="radio" name="t${row.taskId}" /> ${a!.label}</label></li>`)
        .join('')}
    </ul>
  </section>`,
  )
  .join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${project.name} — Preview</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    h1 { border-bottom: 2px solid #333; padding-bottom: .25rem; }
    section { margin: 2rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 6px; }
    table { border-collapse: collapse; width: 100%; margin: .5rem 0; }
    th, td { border: 1px solid #888; padding: .5rem; text-align: center; }
    thead th { background: #f0f0f0; }
    tbody th { background: #fafafa; text-align: left; }
    ul { list-style: none; padding: 0; }
    li { margin: .25rem 0; }
  </style>
</head>
<body>
  <h1>${project.name}</h1>
  <p>${project.description ?? ''}</p>
  ${tasksHtml}
</body>
</html>`

mkdirSync('./out', { recursive: true })
writeFileSync('./out/preview.html', html)
console.log(`Wrote out/preview.html (${html.length} bytes)`)
