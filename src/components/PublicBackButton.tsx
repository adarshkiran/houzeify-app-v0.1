/** "← Back" for the sign-in and onboarding screens, styled like their other header buttons. */
export default function PublicBackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-3.5 inline-flex items-center gap-1.5 border border-[#E3DDD7] rounded-[10px] bg-transparent text-[13px] font-medium text-[#242326] cursor-pointer transition-all duration-200 hover:border-[#722ED1] hover:bg-[#F3EAFF]"
      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}
