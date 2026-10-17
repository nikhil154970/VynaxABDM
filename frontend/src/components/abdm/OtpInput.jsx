export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  className = '',
}) {
  const sanitized = String(value || '').replace(/\D/g, '').slice(0, length);

  return (
    <input
      value={sanitized}
      onChange={(e) => onChange?.(String(e.target.value || '').replace(/\D/g, '').slice(0, length))}
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={length}
      disabled={disabled}
      className={className}
      placeholder={`${length}-digit OTP`}
      autoComplete="one-time-code"
    />
  );
}
