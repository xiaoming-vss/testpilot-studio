type TestPilotLogoProps = {
  size?: number
  className?: string
  title?: string
}

export function TestPilotLogo({ size = 28, className, title = 'TestPilot Logo' }: TestPilotLogoProps) {
  return (
    <img
      src="/testpilot-icon-clean.png"
      alt={title}
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ objectFit: 'contain' }}
    />
  )
}
