import imgBlueprintOverlay from "../imports/HouzeifySplashPage/32ebd1e4c01800c169d4679418fc2c4565c87a9a.png"
import LogoStacked from "../components/LogoStacked"

function BlueprintOverlay() {
  return (
    <div className="absolute h-[900px] left-0 opacity-45 top-0 w-[1440px]" data-name="blueprint-overlay">
      <img alt="" className="absolute inset-0 max-w-none object-cover opacity-75 pointer-events-none size-full" src={imgBlueprintOverlay} />
    </div>
  )
}

function BrandingStack() {
  return (
    <div className="flex flex-col items-center w-full shrink-0" data-name="branding-stack">
      <LogoStacked height={120} />
    </div>
  )
}

function StatusTitleRow() {
  return (
    <div className="flex gap-[8px] items-center shrink-0">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <circle cx="4" cy="4" r="4" fill="#722ED1" />
      </svg>
      <p
        className="leading-[normal] text-[#111322] text-[13px] uppercase tracking-[0.04em] whitespace-nowrap"
        style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
      >
        Initializing AI
      </p>
    </div>
  )
}

function StatusMessage() {
  return (
    <div className="flex flex-col gap-[6px] items-center w-full shrink-0">
      <StatusTitleRow />
      <p
        className="leading-[normal] text-[#686c80] text-[13px] whitespace-nowrap"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif', fontVariationSettings: '"wdth" 100' }}
      >
        Preparing your construction workspace
      </p>
    </div>
  )
}

function ProgressFill() {
  return (
    <div className="bg-[#722ed1] flex h-full items-center justify-end rounded-[3px] shrink-0 w-[160px]">
      <div className="relative shrink-0 size-[12px]">
        <div className="absolute inset-[-50%]">
          <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
            <g filter="url(#sph_filter)">
              <circle cx="12" cy="12" fill="#722ED1" r="6" />
              <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" />
            </g>
            <defs>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="24" id="sph_filter" width="24" x="0" y="0">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
                <feOffset />
                <feGaussianBlur stdDeviation="3" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.329412 0 0 0 0 0.168627 0 0 0 0 0.878431 0 0 0 0.4 0" />
                <feBlend in2="BackgroundImageFix" mode="normal" result="effect1" />
                <feBlend in="SourceGraphic" in2="effect1" mode="normal" result="shape" />
              </filter>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}

function ProgressBarTrack() {
  return (
    <div className="bg-[#ebe8fc] flex h-[6px] items-center rounded-[3px] shrink-0 w-[400px]">
      <ProgressFill />
    </div>
  )
}

function LoaderBlock() {
  return (
    <div className="flex flex-col gap-[20px] items-center w-full shrink-0">
      <StatusMessage />
      <ProgressBarTrack />
    </div>
  )
}

function CapabilitiesRow() {
  const items = ["Plan", "Estimate", "Understand", "Build"]
  return (
    <div className="flex gap-[16px] items-center justify-center pt-[16px] w-full shrink-0">
      {items.map((item, i) => (
        <div key={item} className="flex gap-[16px] items-center shrink-0">
          <p
            className="text-[#686c80] text-[11px] tracking-[0.06em] uppercase"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            {item}
          </p>
          {i < items.length - 1 && (
            <p className="text-[#736e66] text-[11px]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>/</p>
          )}
        </div>
      ))}
    </div>
  )
}

function SplashCard() {
  return (
    <div className="flex flex-col gap-[36px] items-center shrink-0 w-[640px]">
      <BrandingStack />
      <div className="h-0 relative shrink-0 w-[48px]">
        <div className="absolute inset-[-2px_0_0_0]">
          <svg fill="none" height="2" viewBox="0 0 48 2" width="48">
            <line opacity="0.6" stroke="#542BE0" strokeWidth="2" x2="48" y1="1" y2="1" />
          </svg>
        </div>
      </div>
      <p
        className="text-[#722ed1] text-[12px] text-center tracking-[0.04em] uppercase whitespace-nowrap"
        style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
      >
        AI Construction Advisor
      </p>
      <LoaderBlock />
      <CapabilitiesRow />
    </div>
  )
}

export default function SplashScreen() {
  return (
    <div className="bg-[#fcfbf9] flex flex-col items-center justify-center relative size-full">
      <BlueprintOverlay />
      <SplashCard />
    </div>
  )
}
