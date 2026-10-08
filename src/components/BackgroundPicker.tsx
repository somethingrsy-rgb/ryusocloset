import { BG_LABEL, useI18n } from '../i18n'
import { BACKGROUNDS, bgToCss } from '../lib/backgrounds'
import { Modal } from './Modal'

interface Props {
  value: string
  onPick: (id: string) => void
  onClose: () => void
}

export function BackgroundPicker({ value, onPick, onClose }: Props) {
  const { lang, t } = useI18n()
  return (
    <Modal title={t('bgTitle')} onClose={onClose}>
      <ul className="grid grid-cols-4 gap-3 pt-2">
        {BACKGROUNDS.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => {
                onPick(b.id)
                onClose()
              }}
              aria-pressed={b.id === value}
              aria-label={BG_LABEL[lang][b.id]}
              className="flex w-full flex-col items-center gap-1"
            >
              <span
                className={`block aspect-square w-full rounded-2xl ring-2 ${
                  b.id === value ? 'ring-blush-deep' : 'ring-black/10'
                }`}
                style={{ background: bgToCss(b) }}
              />
              <span className="text-[11px] text-cocoa-soft">{BG_LABEL[lang][b.id]}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
