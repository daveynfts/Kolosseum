import { useId } from 'react'
import { ReportMarkdown } from '../components/ReportMarkdown'
import './premiumReportBody.css'

export function PremiumReportBody({ content }: { content: string }) {
  const id = useId()
  const sections = content.split(/(?=^## )/m).filter(section => section.trim())
  return <div className="premium-dossier">
    <nav className="premium-dossier__contents" aria-label="Premium report contents">
      {sections.map((section, index) => <button key={index} onClick={() => document.getElementById(`${id}-${index}`)?.scrollIntoView({ behavior: 'instant', block: 'start' })}>{section.split('\n')[0].replace(/^#+\s*/, '')}</button>)}
    </nav>
    <p className="premium-caption">Tables scroll horizontally on smaller screens. Findings apply to the stated source snapshot.</p>
    {sections.map((section, index) => <section id={`${id}-${index}`} className="premium-dossier__section" key={index}><ReportMarkdown text={section} /></section>)}
  </div>
}
