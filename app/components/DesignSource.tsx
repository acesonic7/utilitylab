'use client'

import { useState } from 'react'
import type { Project } from '@/lib/schema'
import CsvUpload from './CsvUpload'
import DesignGenerator from './DesignGenerator'

type Tab = 'upload' | 'generate'

export default function DesignSource({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const initialTab: Tab = project.design?.source === 'generated' ? 'generate' : 'upload'
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 border-b border-neutral-200">
        <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
          Upload CSV
        </TabButton>
        <TabButton active={tab === 'generate'} onClick={() => setTab('generate')}>
          Generate
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-normal">
            beta
          </span>
        </TabButton>
        {project.design && (
          <span className="ml-auto text-[11px] text-neutral-500">
            Active source:{' '}
            <span className="font-mono text-neutral-700">{project.design.source}</span>
          </span>
        )}
      </div>
      {tab === 'upload' ? (
        <CsvUpload project={project} setProject={setProject} />
      ) : (
        <DesignGenerator project={project} setProject={setProject} />
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
