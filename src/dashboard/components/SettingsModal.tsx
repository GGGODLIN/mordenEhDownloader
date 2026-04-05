import { useState, useEffect } from 'react'
import type { Settings } from '@shared/types'
import { DEFAULT_SETTINGS, TEMPLATE_VARS } from '@shared/constants'
import { storage } from '@shared/storage'
import { recordBan, clearBanFlag } from '@services/ban-tracker'

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

function SelectInput({
  label, value, onChange, options, helper,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; helper?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm rounded-md
          border border-zinc-200 dark:border-zinc-700
          bg-white dark:bg-zinc-800
          text-zinc-900 dark:text-zinc-100
          focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500
          transition-colors"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
              <NumberInput
                label="Delay Between Requests (sec)"
                value={settings.delayRequest}
                onChange={v => update('delayRequest', v)}
                min={0}
                step={0.1}
                helper="Wait time between image downloads"
              />
              <Toggle
                label="Verify Checksum"
                checked={settings.checksum}
                onChange={v => update('checksum', v)}
                helper="SHA-1 hash verification after download"
              />
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Toggle
                  label="Force Resized Image"
                  checked={settings.forceResized}
                  onChange={v => update('forceResized', v)}
                  helper="Skip original image, always download resized version"
                />
              </div>
              {!settings.forceResized && (
                <Toggle
                  label="Force as Logged In"
                  checked={settings.forceAsLoggedIn}
                  onChange={v => update('forceAsLoggedIn', v)}
                  helper="Keep trying original images even on suspension"
                />
              )}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Toggle
                  label="Slow Mode"
                  checked={settings.slowMode}
                  onChange={v => update('slowMode', v)}
                  helper="Use reduced thread/gallery count to avoid IP bans"
                />
              </div>
              {settings.slowMode && (
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput
                    label="Slow Thread Count"
                    value={settings.slowThreadCount}
                    onChange={v => update('slowThreadCount', v)}
                    min={1}
                    max={10}
                    helper="Threads in slow mode"
                  />
                  <NumberInput
                    label="Slow Concurrent Galleries"
                    value={settings.slowMaxConcurrentGalleries}
                    onChange={v => update('slowMaxConcurrentGalleries', v)}
                    min={1}
                    max={5}
                    helper="Galleries in slow mode"
                  />
                </div>
              )}
              <SelectInput
                label="Download from Domain"
                value={settings.originalDownloadDomain}
                onChange={v => update('originalDownloadDomain', v)}
                options={[
                  { value: '', label: 'Current Origin' },
                  { value: 'e-hentai.org', label: 'e-hentai.org' },
                  { value: 'exhentai.org', label: 'exhentai.org' },
                ]}
                helper="Override image download domain"
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
                <>
                  <TextInput
                    label="Number Separator"
                    value={settings.numberSeparator}
                    onChange={v => update('numberSeparator', v)}
                    placeholder=":"
                    helper="Character between number and filename"
                  />
                  <Toggle
                    label="Number with Real Index"
                    checked={settings.numberRealIndex}
                    onChange={v => update('numberRealIndex', v)}
                    helper="Use original page index instead of sequential"
                  />
                </>
              )}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Toggle
                  label="Save Gallery Info"
                  checked={settings.saveGalleryInfo}
                  onChange={v => update('saveGalleryInfo', v)}
                  helper="Include info.txt with gallery metadata in ZIP"
                />
              </div>
              <NumberInput
                label="Compression Level"
                value={settings.compressionLevel}
                onChange={v => update('compressionLevel', v)}
                min={0}
                max={9}
                helper="0 = no compression (STORE), 1-9 = DEFLATE level"
              />
              <Toggle
                label="Replace with Full-Width Characters"
                checked={settings.replaceWithFullWidth}
                onChange={v => update('replaceWithFullWidth', v)}
                helper="Use full-width chars instead of dashes for unsafe characters"
              />
            </div>
          )}

          {activeSection === 'warning' && (
            <div className="flex flex-col gap-4">
              <Toggle
                label="Auto Save on Cancel"
                checked={settings.autoDownloadOnCancel}
                onChange={v => update('autoDownloadOnCancel', v)}
                helper="Save downloaded images when cancelling a gallery"
              />
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Duplicate Check (days)"
                  value={settings.historyCheckDays}
                  onChange={v => update('historyCheckDays', v)}
                  min={0}
                  max={365}
                  helper="0 = disabled"
                />
                <NumberInput
                  label="History Max Items"
                  value={settings.historyMaxItems}
                  onChange={v => update('historyMaxItems', v)}
                  min={0}
                  max={10000}
                  helper="0 = unlimited"
                />
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Toggle
                  label="Peak Hours Warning"
                  checked={settings.peakHoursWarning}
                  onChange={v => update('peakHoursWarning', v)}
                  helper="Warn when downloading during peak hours (slower speeds)"
                />
              </div>
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
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Test Notification</span>
                  <button
                    onClick={() => {
                      clearBanFlag()
                      recordBan()
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-medium rounded-md
                      text-zinc-600 dark:text-zinc-300
                      bg-zinc-100 dark:bg-zinc-800
                      hover:bg-zinc-200 dark:hover:bg-zinc-700
                      transition-colors"
                  >
                    Send IP Ban Notification
                  </button>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    Test if Chrome notifications are working
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
