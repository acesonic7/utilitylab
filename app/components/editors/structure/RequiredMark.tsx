// Visible marker only; the control itself carries aria-required or always has a value.
export function RequiredMark() {
  return (
    <span aria-hidden="true" title="Required" className="ml-0.5 font-semibold text-risk">
      *
    </span>
  )
}
