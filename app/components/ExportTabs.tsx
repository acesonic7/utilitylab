'use client'

import { useState } from 'react'
import type { Project } from '@/lib/schema'
import ExportButtons from './ExportButtons'
import LimeSurveyPush from './LimeSurveyPush'

type Tab = 'files' | 'limesurvey'

export default function ExportTabs({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const [tab, setTab] = useState<Tab>('files')

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 border-b border-neutral-200">
        <TabButton active={tab === 'files'} onClick={() => setTab('files')}>
          Files
        </TabButton>
        <TabButton active={tab === 'limesurvey'} onClick={() => setTab('limesurvey')}>
          Push to LimeSurvey
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-normal">
            beta
          </span>
        </TabButton>
      </div>
      {tab === 'files' ? (
        <ExportButtons project={project} />
      ) : (
        <LimeSurveyPush project={project} setProject={setProject} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 -mb-[2px] transition ${
        active
          ? 'border-indigo-600 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}
