import { useEffect, useMemo, useRef, useState } from 'react';
import { MdCheckCircle, MdClose, MdHealthAndSafety, MdInfo } from 'react-icons/md';
import OtpInput from './OtpInput';
import {
  getAbdmErrorMessage,
  normalizeMobile,
  requestAadhaarOtp,
  requestExistingAbhaOtp,
  verifyAadhaarOtp,
  verifyExistingAbhaOtp,
} from '../../services/abdm/abhaService';

const RESEND_COOLDOWN_SEC = 60;

function getAadhaarValidationMessage(aadhaar) {
  const value = String(aadhaar || '').replace(/\D/g, '');
  if (!value) return 'Aadhaar number is required.';
  if (!/^\d{12}$/.test(value)) return 'Aadhaar number must be 12 digits.';
  return '';
}

function getFriendlyVerifyError(err) {
  const raw = String(getAbdmErrorMessage(err, '') || '').trim();
  if (!raw) return 'OTP verify request failed. Please try again.';

  const lower = raw.toLowerCase();
  if (lower.includes('gateway is unavailable') || lower.includes('abdm-1206')) {
    return 'Government server temporary unavailable, please retry later.';
  }
  if (lower.includes('otp') && (lower.includes('invalid') || lower.includes('incorrect') || lower.includes('failed'))) {
    return raw;
  }
  return `Government response: ${raw}`;
}

export default function AbhaVerificationModal({
  open,
  onClose,
  flow = 'create', // create | link
  initialAadhaar = '',
  initialMobile = '',
  onOtpSent,
  onAbhaCreated,
}) {
  const [step, setStep] = useState('aadhaar'); // aadhaar | otp | success
  const [aadhaar, setAadhaar] = useState('');
  const [searchType, setSearchType] = useState('abha-number'); // link flow
  const [searchValue, setSearchValue] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [verifyOtpLoading, setVerifyOtpLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const wasOpenRef = useRef(false);
  const closeTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const aadhaarValidationMessage = useMemo(
    () => getAadhaarValidationMessage(aadhaar),
    [aadhaar]
  );
  const searchValidationMessage = useMemo(() => {
    const v = String(searchValue || '').trim();
    if (!v) return 'Enter ABHA Number or ABHA Address.';
    return '';
  }, [searchValue]);
  const busy = sendOtpLoading || verifyOtpLoading;
  const canResend = resendSeconds <= 0 && !busy;

  const clearTimers = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startResendCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResendSeconds(RESEND_COOLDOWN_SEC);
    countdownRef.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetInternalState = (seedAadhaar = '', seedMobile = '') => {
    clearTimers();
    setStep('aadhaar');
    setAadhaar(String(seedAadhaar || '').replace(/\D/g, '').slice(0, 12));
    setSearchType('abha-number');
    setSearchValue('');
    setMobile(normalizeMobile(seedMobile));
    setOtp('');
    setTxnId('');
    setOtpSentMessage('');
    setProfile(null);
    setError('');
    setSendOtpLoading(false);
    setVerifyOtpLoading(false);
    setResendSeconds(0);
  };

  // Reset only when the modal opens (false → true).
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetInternalState(initialAadhaar, initialMobile);
    }
    if (!open && wasOpenRef.current) {
      clearTimers();
    }
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep mobile in sync from registration form without clearing txnId/OTP step.
  useEffect(() => {
    if (!open) return;
    const next = normalizeMobile(initialMobile);
    if (next) setMobile(next);
  }, [open, initialMobile]);

  useEffect(() => () => clearTimers(), []);

  const resetAndClose = () => {
    if (busy) return;
    clearTimers();
    onClose?.();
  };

  const resolveMobileForApi = () => normalizeMobile(mobile) || normalizeMobile(initialMobile);

  const mobileValidationMessage = useMemo(() => {
    if (flow !== 'create') return '';
    const value = resolveMobileForApi();
    if (!value) {
      return 'Enter a valid 10-digit mobile number (from registration form or below).';
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, mobile, initialMobile]);

  if (!open) return null;

  const handleSendOtp = async ({ isResend = false } = {}) => {
    if (flow === 'create') {
      if (aadhaarValidationMessage) {
        setError(aadhaarValidationMessage);
        return;
      }
      if (mobileValidationMessage) {
        setError(mobileValidationMessage);
        return;
      }
    } else if (searchValidationMessage) {
      setError(searchValidationMessage);
      return;
    }

    const phone = resolveMobileForApi();

    setError('');
    setSendOtpLoading(true);
    if (phone) setMobile(phone);

    try {
      let res;
      if (flow === 'create') {
        // Pass mobile (when available) so backend can preserve it against txnId for enrol/byAadhaar.
        // Government OTP request body is unchanged; mobile is only stored for the verify step.
        res = await requestAadhaarOtp(aadhaar, phone || undefined);
      } else {
        res = await requestExistingAbhaOtp({
          loginHint: searchType,
          loginId: searchValue,
        });
      }
      if (!res?.txnId) {
        setError(res?.message || 'Unable to request OTP. Please try again.');
        return;
      }

      setTxnId(res.txnId);
      setOtp('');
      setOtpSentMessage(
        isResend
          ? 'OTP has been resent to the Aadhaar linked mobile number.'
          : 'OTP has been sent to the Aadhaar linked mobile number.'
      );
      setStep('otp');
      startResendCountdown();

      onOtpSent?.({
        txnId: res.txnId,
        aadhaar: String(aadhaar).replace(/\D/g, ''),
        loginHint: flow === 'link' ? searchType : undefined,
        loginId: flow === 'link' ? String(searchValue || '').trim() : undefined,
        mobile: phone,
        message: res.message,
        raw: res.raw,
      });
    } catch (err) {
      setError(
        flow === 'create'
          ? getAbdmErrorMessage(err, 'Failed to send OTP. Please verify Aadhaar number and try again.')
          : getAbdmErrorMessage(err, 'Failed to send OTP. Please verify ABHA Number/Address and try again.')
      );
    } finally {
      setSendOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(String(otp || ''))) {
      setError('OTP must be a valid 6-digit number.');
      return;
    }
    if (!txnId) {
      setError('Transaction ID missing. Please request OTP again.');
      return;
    }
    if (flow === 'create' && mobileValidationMessage) {
      setError(mobileValidationMessage);
      return;
    }

    setError('');
    setVerifyOtpLoading(true);

    try {
      const nextProfile = flow === 'create'
        ? await verifyAadhaarOtp({
          txnId,
          otp,
          mobile: resolveMobileForApi(),
        })
        : await verifyExistingAbhaOtp({
          txnId,
          otp,
        });

      if (!nextProfile?.abhaNumber && !nextProfile?.abhaAddress) {
        setError(nextProfile?.message || 'ABHA details not returned by ABDM. Please try again.');
        return;
      }

      setProfile(nextProfile);
      setStep('success');
      onAbhaCreated?.(nextProfile, {
        flow,
        aadhaar: String(aadhaar).replace(/\D/g, ''),
        loginHint: flow === 'link' ? searchType : undefined,
        loginId: flow === 'link' ? String(searchValue || '').trim() : undefined,
        mobile: resolveMobileForApi(),
        txnId: nextProfile.txnId || txnId,
      });

      closeTimerRef.current = setTimeout(() => {
        onClose?.();
      }, 1200);
    } catch (err) {
      setError(getFriendlyVerifyError(err));
    } finally {
      setVerifyOtpLoading(false);
    }
  };

  const handleChangeAadhaar = () => {
    if (busy) return;
    clearTimers();
    setStep('aadhaar');
    setOtp('');
    setTxnId('');
    setOtpSentMessage('');
    setProfile(null);
    setError('');
    setResendSeconds(0);
  };

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={resetAndClose}
        role="button"
        tabIndex={-1}
        aria-label="Close ABHA modal"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#f8faff]">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                <MdHealthAndSafety className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-gray-900">
                  {flow === 'create' ? 'Create ABHA' : 'Link Existing ABHA'}
                </h3>
                <p className="text-xs text-gray-500">
                  {step === 'aadhaar' && (flow === 'create' ? 'Enter Aadhaar to receive OTP' : 'Search ABHA and receive OTP')}
                  {step === 'otp' && (flow === 'create' ? 'Verify OTP sent to Aadhaar-linked mobile' : 'Verify OTP sent to ABHA-linked mobile')}
                  {step === 'success' && 'ABHA verification complete'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-60"
            >
              <MdClose className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {step === 'aadhaar' ? (
              <>
                {flow === 'create' ? (
                  <>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-600 mb-1.5">
                        Aadhaar Number
                      </label>
                      <input
                        value={aadhaar}
                        onChange={(e) => {
                          setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12));
                          setError('');
                        }}
                        className="rp-input"
                        placeholder="Enter 12-digit Aadhaar number"
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={sendOtpLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-600 mb-1.5">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={mobile}
                        onChange={(e) => {
                          setMobile(normalizeMobile(e.target.value) || e.target.value.replace(/\D/g, '').slice(0, 10));
                          setError('');
                        }}
                        className="rp-input"
                        placeholder="10-digit mobile (auto-filled from registration form)"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={10}
                        disabled={sendOtpLoading}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        OTP is sent to your Aadhaar-linked mobile. This number is linked to the new ABHA account.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-600 mb-1.5">
                        Search By
                      </label>
                      <select
                        value={searchType}
                        onChange={(e) => {
                          setSearchType(e.target.value);
                          setSearchValue('');
                          setError('');
                        }}
                        className="rp-input"
                        disabled={sendOtpLoading}
                      >
                        <option value="abha-number">ABHA Number</option>
                        <option value="abha-address">ABHA Address</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-600 mb-1.5">
                        {searchType === 'abha-number' ? 'ABHA Number' : 'ABHA Address'}
                      </label>
                      <input
                        value={searchValue}
                        onChange={(e) => {
                          setSearchValue(e.target.value);
                          setError('');
                        }}
                        className="rp-input"
                        placeholder={searchType === 'abha-number' ? 'Enter ABHA Number' : 'Enter ABHA Address'}
                        autoComplete="off"
                        disabled={sendOtpLoading}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleSendOtp({ isResend: false })}
                    disabled={Boolean(flow === 'create' ? (aadhaarValidationMessage || mobileValidationMessage) : searchValidationMessage) || sendOtpLoading}
                    className="rp-primaryBtn !min-w-[170px] !py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sendOtpLoading ? 'Sending OTP…' : 'Send OTP'}
                  </button>
                </div>
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 font-semibold">
                  {otpSentMessage || 'OTP has been sent to the Aadhaar linked mobile number.'}
                </div>

                {flow === 'create' ? (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1.5">
                      Mobile for ABHA <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={mobile}
                      onChange={(e) => {
                        setMobile(normalizeMobile(e.target.value) || e.target.value.replace(/\D/g, '').slice(0, 10));
                        setError('');
                      }}
                      className="rp-input"
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      disabled={verifyOtpLoading}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      {resolveMobileForApi()
                        ? `Using mobile ${resolveMobileForApi()} for ABHA enrolment.`
                        : 'Enter the same mobile number from the registration form.'}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-[11px] font-semibold text-gray-500">{flow === 'create' ? 'Aadhaar' : 'ABHA'}</p>
                  <p className="font-bold text-gray-800">
                    {flow === 'create'
                      ? `XXXX-XXXX-${String(aadhaar).slice(-4)}`
                      : String(searchValue || '—')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-600 mb-1.5">
                    6-digit OTP
                  </label>
                  <OtpInput
                    value={otp}
                    onChange={(nextOtp) => {
                      setOtp(nextOtp);
                      setError('');
                    }}
                    length={6}
                    disabled={verifyOtpLoading}
                    className="rp-input"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                  <span>
                    {resendSeconds > 0
                      ? `Resend OTP in ${resendSeconds}s`
                      : 'You can resend OTP now'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendOtp({ isResend: true })}
                    disabled={!canResend}
                    className="font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {sendOtpLoading ? 'Resending…' : 'Resend OTP'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleChangeAadhaar}
                    disabled={busy}
                    className="rp-ghostBtn !py-2.5"
                  >
                    {flow === 'create' ? 'Change Aadhaar' : 'Change Search'}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyOtpLoading || !/^\d{6}$/.test(String(otp || ''))}
                    className="rp-primaryBtn !min-w-[170px] !py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {verifyOtpLoading ? 'Verifying OTP…' : 'Verify OTP'}
                  </button>
                </div>
              </>
            ) : null}

            {step === 'success' ? (
              <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-3 text-sm text-green-700 font-semibold">
                <div className="flex items-center gap-2">
                  <MdCheckCircle className="w-5 h-5 text-green-600" />
                  <span>ABHA Verified ✓</span>
                </div>
                {profile?.abhaNumber ? (
                  <p className="mt-1 text-xs font-medium text-green-800">
                    {profile.abhaNumber}
                    {profile.abhaAddress ? ` · ${profile.abhaAddress}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="flex items-start gap-2">
                  <MdInfo className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
