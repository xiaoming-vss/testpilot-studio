type TestPilotLogoProps = {
  size?: number
  className?: string
  title?: string
}

export function TestPilotLogo({ size = 28, className, title = 'TestPilot Logo' }: TestPilotLogoProps) {
  const logoClassName = ['testpilot-logo', className].filter(Boolean).join(' ')

  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      className={logoClassName}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="testpilot-logo__plate" x="4" y="4" width="40" height="40" rx="14" />
      <path className="testpilot-logo__glow" d="M9.5 18.2C12.1 10.9 17.8 8 27.7 8H31.5C36.9 8 40 11.1 40 16.5" />
      <path className="testpilot-logo__mark" d="M15 15.5H33M24 15.5V35" />
      <path className="testpilot-logo__route" d="M16.2 28.8L21.4 34L32.6 20.2" />
      <path className="testpilot-logo__wing" d="M29.2 16.2L35.8 12.8L33.5 20.1L31.8 17.6L29.2 16.2Z" />
      <circle className="testpilot-logo__origin" cx="16.2" cy="28.8" r="2.6" />
    </svg>
  )
}
