export type AmbientBgVariant = "create-project" | "estimate-loading" | "estimate-dashboard" | "cost-breakdown"

interface Blob {
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
  transform?: string
  width: number
  height: number
  backgroundColor: string
  filter: string
}

const VARIANTS: Record<AmbientBgVariant, Blob[]> = {
  "create-project": [
    { top: -80, right: -200, width: 580, height: 580, backgroundColor: "rgba(114,46,209,0.05)", filter: "blur(130px)" },
    { bottom: -150, left: -100, width: 500, height: 500, backgroundColor: "rgba(243,234,255,0.60)", filter: "blur(120px)" },
    { top: "60%", right: "10%", width: 340, height: 340, backgroundColor: "rgba(243,234,255,0.45)", filter: "blur(90px)" },
  ],
  "estimate-loading": [
    { top: -120, right: -180, width: 600, height: 600, backgroundColor: "rgba(114,46,209,0.048)", filter: "blur(130px)" },
    { bottom: -160, left: -120, width: 680, height: 680, backgroundColor: "rgba(243,234,255,0.55)", filter: "blur(140px)" },
    { top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 520, height: 520, backgroundColor: "rgba(114,46,209,0.028)", filter: "blur(110px)" },
  ],
  "estimate-dashboard": [
    { top: -100, right: -180, width: 560, height: 560, backgroundColor: "rgba(114,46,209,0.045)", filter: "blur(120px)" },
    { bottom: -160, left: -100, width: 620, height: 620, backgroundColor: "rgba(243,234,255,0.52)", filter: "blur(140px)" },
    { top: "40%", left: "42%", transform: "translate(-50%,-50%)", width: 480, height: 480, backgroundColor: "rgba(114,46,209,0.026)", filter: "blur(100px)" },
  ],
  "cost-breakdown": [
    { top: -100, right: -180, width: 560, height: 560, backgroundColor: "rgba(114,46,209,0.042)", filter: "blur(130px)" },
    { bottom: -160, left: -100, width: 640, height: 640, backgroundColor: "rgba(243,234,255,0.50)", filter: "blur(140px)" },
    { top: "55%", right: "15%", width: 380, height: 380, backgroundColor: "rgba(243,234,255,0.38)", filter: "blur(90px)" },
  ],
}

/** The purple-blur ambient background behind every estimate-flow screen. Same idea, different sizing per screen — kept exact, not unified. */
export default function AmbientBg({ variant }: { variant: AmbientBgVariant }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      {VARIANTS[variant].map((blob, i) => (
        <div key={i} className="absolute rounded-full" style={blob} />
      ))}
    </div>
  )
}
