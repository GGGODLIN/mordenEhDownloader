import { useState, useEffect } from 'react'
import type { Settings } from '@shared/types'
import { DEFAULT_SETTINGS, TEMPLATE_VARS } from '@shared/constants'
import { storage } from '@shared/storage'

interface SettingsModalProps {
  onClose: () => void
}

type Section = 'download' | 'file' | 'warning'

function NumberInput({
  label, value, onChange, min, max, step, helper,
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; helper?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step ?? 1}
        className="w-full px-2.5 py-1.5 text-sm rounded-md
          border border-zinc-200 dark:border-zinc-700
          bg-white dark:bg-zinc-800
          text-zinc-900 dark:text-zinc-100
          font-mono tabular-nums
          focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500
          transition-colors"
      />
      {helper && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{helper}</span>
      )}
    </div>
  )
}

function Toggle({
  label, checked, onChange, helper,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; helper?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {helper && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{helper}</span>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${
          checked
            ? 'bg-emerald-500'
            : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm
            transition-transform duration-200 ${
            checked ? 'left-[17px]' : 'left-[2px]'
          }`}
        />
      </button>
    </div>
  )
}

function TextInput({
  label, value, onChange, helper, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  helper?: string; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm rounded-md
          border border-zinc-200 dark:border-zinc-700
          bg-white dark:bg-zinc-800
          text-zinc-900 dark:text-zinc-100
          focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500
          transition-colors"
      />
      {helper && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{helper}</span>
      )}
    </div>
  )
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [activeSection, setActiveSection] = useState<Section>('download')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    storage.getSettings().then(s => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    storage.setSettings(next)
  }

  const sections: { key: Section; label: string }[] = [
    { key: 'download', label: 'Download' },
    { key: 'file', label: 'File' },
    { key: 'warning', label: 'Warning' },
  ]

  if (!loaded) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-zinc-950/40 dark:bg-zinc-950/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden
        bg-white dark:bg-zinc-900
        shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]
        border border-zinc-200 dark:border-zinc-700/50">
        <div className="flex items-center justify-between px-5 py-3.5
          border-b border-zinc-200 dark:border-zinc-700/50">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md
              text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100
              dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800
              transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-zinc-200 dark:border-zinc-700/50">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex-1 px-4 py-2 text-xs font-medium tracking-wide transition-colors relative
                ${activeSection === s.key
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
            >
              {s.label}
              {activeSection === s.key && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5
                  bg-zinc-900 dark:bg-zinc-100 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {activeSection === 'download' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Thread Count"
                  value={settings.threadCount}
                  onChange={v => update('threadCount', v)}
                  min={1}
                  max={10}
                  helper="Parallel image downloads"
                />
                <NumberInput
                  label="Concurrent Galleries"
                  value={settings.maxConcurrentGalleries}
                  onChange={v => update('maxConcurrentGalleries', v)}
                  min={1}
                  max={5}
                  helper="Galleries downloading at once"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Retry Count"
                  value={settings.retryCount}
                  onChange={v => update('retryCount', v)}
                  min={0}
                  max={10}
                  helper="Max retries per image"
                />
                <NumberInput
                  label="Timeout (sec)"
                  value={settings.timeout}
                  onChange={v => update('timeout', v)}
                  min={30}
                  max={600}
                  helper="Request timeout"
                />
              </div>
              <NumberInput
                label="Periodic Retry Interval (sec)"
                value={settings.periodicRetrySec}
                onChange={v => update('periodicRetrySec', v)}
                min={10}
                max={600}
                helper="Auto-retry failed images every N seconds"
              />
              <Toggle
                label="Verify Checksum"
                checked={settings.checksum}
                onChange={v => update('checksum', v)}
                helper="SHA-1 hash verification after download"
              />
            </div>
          )}

          {activeSection === 'file' && (
            <div className="flex flex-col gap-4">
              <TextInput
                label="ZIP Directory Name"
                value={settings.dirNameTemplate}
                onChange={v => update('dirNameTemplate', v)}
                placeholder="/"
                helper={'Use "/" for no folder inside ZIP'}
              />
              <TextInput
                label="ZIP File Name"
                value={settings.fileNameTemplate}
                onChange={v => update('fileNameTemplate', v)}
                placeholder="{title}"
              />
              <div className="flex flex-wrap gap-1.5 px-1">
                {TEMPLATE_VARS.map(v => (
                  <span
                    key={v}
                    className="px-1.5 py-0.5 text-[10px] font-mono rounded
                      bg-zinc-100 text-zinc-500
                      dark:bg-zinc-800 dark:text-zinc-400
                      select-all cursor-text"
                  >
                    {v}
                  </span>
                ))}
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Toggle
                  label="Auto-number Images"
                  checked={settings.numberImages}
                  onChange={v => update('numberImages', v)}
                  helper="Prepend index number to filenames"
                />
              </div>
              {settings.numberImages && (
                <TextInput
                  label="Number Separator"
                  value={settings.numberSeparator}
                  onChange={v => update('numberSeparator', v)}
                  placeholder=":"
                  helper="Character between number and filename"
                />
              )}
            </div>
          )}

          {activeSection === 'warning' && (
            <div className="flex flex-col gap-4">
              <Toggle
                label="Peak Hours Warning"
                checked={settings.peakHoursWarning}
                onChange={v => update('peakHoursWarning', v)}
                helper="Warn when downloading during peak hours (slower speeds)"
              />
              <Toggle
                label="Image Limits Warning"
                checked={settings.imageLimitsWarning}
                onChange={v => update('imageLimitsWarning', v)}
                helper="Warn when approaching image viewing limits"
              />
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Toggle
                  label="Speed Detection"
                  checked={settings.speedDetect}
                  onChange={v => update('speedDetect', v)}
                  helper="Monitor and flag slow download speeds"
                />
              </div>
              {settings.speedDetect && (
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput
                    label="Min Speed (KB/s)"
                    value={settings.speedMinKBs}
                    onChange={v => update('speedMinKBs', v)}
                    min={1}
                    max={100}
                    helper="Below this = slow"
                  />
                  <NumberInput
                    label="Low Speed Timeout (sec)"
                    value={settings.speedExpiredSec}
                    onChange={v => update('speedExpiredSec', v)}
                    min={5}
                    max={120}
                    helper="Abort if slow for this long"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
