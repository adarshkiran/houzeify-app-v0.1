import svgPaths from "./svg-8sxhdropel";
import imgBlueprintOverlay from "./32ebd1e4c01800c169d4679418fc2c4565c87a9a.png";

function BlueprintOverlay() {
  return (
    <div className="absolute h-[900px] left-0 opacity-45 top-0 w-[1440px]" data-name="blueprint-overlay">
      <img alt="" className="absolute inset-0 max-w-none object-cover opacity-75 pointer-events-none size-full" src={imgBlueprintOverlay} />
    </div>
  );
}

function Group() {
  return (
    <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative row-1">
      <div className="bg-white border-3 border-solid border-white col-1 ml-0 mt-0 relative row-1 size-[14.572px]" />
      <div className="bg-white border-3 border-solid border-white col-1 h-[49.182px] ml-0 mt-[19.13px] relative row-1 w-[14.572px]" />
      <div className="bg-white col-1 ml-[44.63px] mt-0 relative row-1 size-[14.572px]" />
      <div className="bg-white col-1 h-[49.182px] ml-[44.63px] mt-[19.13px] relative row-1 w-[14.572px]" />
    </div>
  );
}

function Group1() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Group />
      <div className="col-1 flex h-[23.385px] items-center justify-center ml-[12.92px] mt-[20.31px] relative row-1 w-[16.615px]">
        <div className="flex-none rotate-90">
          <div className="h-[16.615px] relative w-[23.385px]">
            <svg className="absolute block inset-0 size-full" fill="none" height="16.6154" preserveAspectRatio="none" viewBox="0 0 23.3846 16.6154" width="23.3846">
              <path d={svgPaths.p16267280} fill="white" id="Rectangle 5" stroke="white" strokeWidth="3" />
            </svg>
          </div>
        </div>
      </div>
      <div className="col-1 flex h-[23.385px] items-center justify-center ml-[29.54px] mt-[20.31px] relative row-1 w-[16.615px]">
        <div className="-rotate-90 -scale-y-100 flex-none">
          <div className="h-[16.615px] relative w-[23.385px]">
            <svg className="absolute block inset-0 size-full" fill="none" height="16.6154" preserveAspectRatio="none" viewBox="0 0 23.3846 16.6154" width="23.3846">
              <path d={svgPaths.p221b8100} fill="white" id="Rectangle 6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoIconContainer() {
  return (
    <div className="bg-[#722ed1] content-stretch drop-shadow-[0px_12px_16px_rgba(84,43,224,0.17)] flex flex-col items-center justify-center relative rounded-[16px] shrink-0 size-[112px]" data-name="logo-icon-container">
      <Group1 />
    </div>
  );
}

function BrandTextGroup() {
  return (
    <div className="[word-break:break-word] content-stretch flex flex-col gap-[8px] items-center not-italic relative shrink-0 text-[#111322] text-center w-full whitespace-nowrap" data-name="brand-text-group">
      <p className="font-['Google_Sans_Flex:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[54px]" style={{ fontVariationSettings: '"GRAD" 0, "ROND" 0, "wdth" 100' }}>
        Houzeify
      </p>
      <p className="font-['Geist:Medium',sans-serif] font-medium leading-[0] relative shrink-0 text-[20px]">
        <span className="font-['Google_Sans_Flex:Medium',sans-serif] leading-[normal]" style={{ fontVariationSettings: '"GRAD" 0, "ROND" 0, "wdth" 100' }}>{`Build Smart. `}</span>
        <span className="font-['Google_Sans_Flex:SemiBold',sans-serif] font-semibold leading-[normal] text-[#722ed1]" style={{ fontVariationSettings: '"GRAD" 0, "ROND" 0, "wdth" 100' }}>
          Build Confidently.
        </span>
      </p>
    </div>
  );
}

function BrandingStack() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-center relative shrink-0 w-full" data-name="branding-stack">
      <LogoIconContainer />
      <BrandTextGroup />
    </div>
  );
}

function StatusTitleRow() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="status-title-row">
      <div className="relative shrink-0 size-[8px]" data-name="Ellipse">
        <svg className="absolute block inset-0 size-full" fill="none" height="8" preserveAspectRatio="none" viewBox="0 0 8 8" width="8">
          <circle cx="4" cy="4" fill="#722ED1" id="Ellipse" r="4" />
        </svg>
      </div>
      <p className="[word-break:break-word] font-['Sometype_Mono:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[#111322] text-[13px] uppercase whitespace-nowrap">Initializing AI</p>
    </div>
  );
}

function StatusMessage() {
  return (
    <div className="content-stretch flex flex-col gap-[6px] items-center relative shrink-0 w-full" data-name="status-message">
      <StatusTitleRow />
      <p className="[word-break:break-word] font-['Open_Sans:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#686c80] text-[13px] whitespace-nowrap" style={{ fontVariationSettings: '"wdth" 100' }}>
        Preparing your construction workspace
      </p>
    </div>
  );
}

function ProgressFill() {
  return (
    <div className="bg-[#722ed1] content-stretch flex h-full items-center justify-end relative rounded-[3px] shrink-0 w-[160px]" data-name="progress-fill">
      <div className="relative shrink-0 size-[12px]" data-name="progress-node">
        <div className="absolute inset-[-50%]">
          <svg className="block size-full" fill="none" height="24" preserveAspectRatio="none" viewBox="0 0 24 24" width="24">
            <g filter="url(#filter0_d_0_4)" id="progress-node">
              <circle cx="12" cy="12" fill="#722ED1" r="6" />
              <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" />
            </g>
            <defs>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="24" id="filter0_d_0_4" width="24" x="0" y="0">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
                <feOffset />
                <feGaussianBlur stdDeviation="3" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.329412 0 0 0 0 0.168627 0 0 0 0 0.878431 0 0 0 0.4 0" />
                <feBlend in2="BackgroundImageFix" mode="normal" result="effect1_dropShadow_0_4" />
                <feBlend in="SourceGraphic" in2="effect1_dropShadow_0_4" mode="normal" result="shape" />
              </filter>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

function ProgressBarTrack() {
  return (
    <div className="bg-[#ebe8fc] content-stretch flex h-[6px] items-center relative rounded-[3px] shrink-0 w-[400px]" data-name="progress-bar-track">
      <ProgressFill />
    </div>
  );
}

function LoaderBlock() {
  return (
    <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0 w-full" data-name="loader-block">
      <StatusMessage />
      <ProgressBarTrack />
    </div>
  );
}

function CapabilityPlan() {
  return (
    <div className="[word-break:break-word] content-stretch flex gap-[16px] items-center leading-[normal] relative shrink-0 text-[11px] whitespace-nowrap" data-name="capability-Plan">
      <p className="font-['Geist_Mono:SemiBold',sans-serif] font-semibold relative shrink-0 text-[#686c80] tracking-[0.66px] uppercase">Plan</p>
      <p className="font-['Geist_Mono:Regular',sans-serif] font-normal relative shrink-0 text-[#736e66]">/</p>
    </div>
  );
}

function CapabilityEstimate() {
  return (
    <div className="[word-break:break-word] content-stretch flex gap-[16px] items-center leading-[normal] relative shrink-0 text-[11px] whitespace-nowrap" data-name="capability-Estimate">
      <p className="font-['Sometype_Mono:SemiBold',sans-serif] font-semibold relative shrink-0 text-[#686c80] tracking-[0.66px] uppercase">Estimate</p>
      <p className="font-['Geist_Mono:Regular',sans-serif] font-normal relative shrink-0 text-[#736e66]">/</p>
    </div>
  );
}

function CapabilityUnderstand() {
  return (
    <div className="[word-break:break-word] content-stretch flex gap-[16px] items-center leading-[normal] relative shrink-0 text-[11px] whitespace-nowrap" data-name="capability-Understand">
      <p className="font-['Geist_Mono:SemiBold',sans-serif] font-semibold relative shrink-0 text-[#686c80] tracking-[0.66px] uppercase">Understand</p>
      <p className="font-['Geist_Mono:Regular',sans-serif] font-normal relative shrink-0 text-[#736e66]">/</p>
    </div>
  );
}

function CapabilityBuild() {
  return (
    <div className="content-stretch flex items-center relative shrink-0" data-name="capability-Build">
      <p className="[word-break:break-word] font-['Geist_Mono:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[#686c80] text-[11px] tracking-[0.66px] uppercase whitespace-nowrap">Build</p>
    </div>
  );
}

function CapabilitiesRow() {
  return (
    <div className="content-stretch flex gap-[16px] items-center justify-center pt-[16px] relative shrink-0 w-full" data-name="capabilities-row">
      <CapabilityPlan />
      <CapabilityEstimate />
      <CapabilityUnderstand />
      <CapabilityBuild />
    </div>
  );
}

function SplashCard() {
  return (
    <div className="content-stretch flex flex-col gap-[36px] items-center relative shrink-0 w-[640px]" data-name="splash-card">
      <BrandingStack />
      <div className="h-0 relative shrink-0 w-[48px]" data-name="Line">
        <div className="absolute inset-[-2px_0_0_0]">
          <svg className="block size-full" fill="none" height="2" preserveAspectRatio="none" viewBox="0 0 48 2" width="48">
            <line id="Line" opacity="0.6" stroke="#542BE0" strokeWidth="2" x2="48" y1="1" y2="1" />
          </svg>
        </div>
      </div>
      <p className="[word-break:break-word] font-['Sometype_Mono:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[#722ed1] text-[12px] text-center tracking-[0.48px] uppercase whitespace-nowrap">AI Construction Advisor</p>
      <LoaderBlock />
      <CapabilitiesRow />
    </div>
  );
}

export default function HouzeifySplashPage() {
  return (
    <div className="bg-[#fcfbf9] content-stretch flex flex-col items-center justify-center relative size-full" data-name="houzeify-splash-page">
      <BlueprintOverlay />
      <SplashCard />
    </div>
  );
}