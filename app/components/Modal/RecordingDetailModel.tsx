import Modal from ".";
import { Input, Select } from "../index";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useEffect, useMemo, useState } from "react";
import { getHospitalParamsFromUrl } from "../../utils/hospital-params";
import { getPreferredMicDeviceId } from "../../utils/mic-preference";
import { useFeature } from "../../hooks/useFeatureFlags";
import { FeatureKeys } from "../../types/feature-flags";
import { useDoctorLanguagesAndTemplates } from "../../hooks/useDoctorLanguagesAndTemplates";
import { usePreferredLanguage } from "../../hooks/usePreferredLanguage";

// Dubai: URN + Episode ID setup. Global/other: MRN-only setup. Mic test lives in the navbar (MicrophoneStatusIndicator) for all regions.
const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

type SessionFormValues = {
  mrn: string;
  episode_id: string;
  department: string;
  language: string;
  termsAccepted: boolean;
};

function buildSessionPayload(
  values: SessionFormValues,
  opts: {
    hasCustomTemplates: boolean;
    hasMultiLanguageSupport: boolean;
    templateNameOptions: { value: string; label: string }[];
    languageOptions: { value: string; label: string }[];
    audioInputDeviceId?: string;
  },
) {
  let normalizedDepartment = values.department;
  if (opts.hasCustomTemplates && values.department) {
    const dept = opts.templateNameOptions.find(
      (opt) =>
        opt.value === values.department || opt.label === values.department,
    );
    normalizedDepartment = dept?.value || "ED";
  } else {
    normalizedDepartment = "ED";
  }

  let normalizedLanguage = values.language;
  if (opts.hasMultiLanguageSupport && values.language) {
    const lang = opts.languageOptions.find(
      (opt) =>
        opt.value === values.language || opt.label === values.language,
    );
    normalizedLanguage = lang?.value || "english";
  } else {
    normalizedLanguage = "english";
  }

  const { termsAccepted: _termsAccepted, episode_id, ...sessionFields } =
    values;
  const hospitalParams = getHospitalParamsFromUrl();

  const sessionData: Record<string, unknown> = {
    ...sessionFields,
    department: normalizedDepartment,
    language: normalizedLanguage,
  };

  if (opts.audioInputDeviceId) {
    sessionData.audioInputDeviceId = opts.audioInputDeviceId;
  }

  if (isDubaiRegion) {
    sessionData.episode_id = episode_id;
  }

  if (hospitalParams && Object.keys(hospitalParams).length > 0) {
    sessionData.hospital_data = hospitalParams;
  }

  return sessionData;
}

interface RecordingModalProps {
  onClose: () => void;
  onStart: () => void;
  setSessionData: (data: any) => void;
}

const RecordingDetailModal = ({
  onClose,
  onStart,
  setSessionData,
}: RecordingModalProps) => {
  const { templates, languages, loading: optionsLoading } =
    useDoctorLanguagesAndTemplates();
  const templatesLoading = optionsLoading;
  const languagesLoading = optionsLoading;
  const { preferredLanguage } = usePreferredLanguage();

  // Memoize options so they keep referential equality between renders. Without
  // this the prefill effect below would never settle (deps would change every
  // render) and we'd also recompute on every keystroke.
  const templateNameOptions = useMemo(
    () =>
      (templates ?? []).map((item) => ({
        value: item?.code,
        label: item?.name,
      })),
    [templates],
  );

  const languageOptions = useMemo(
    () =>
      (languages ?? []).map((item) => ({
        value: item?.name,
        label: item?.name
          ? item.name
              .split(" + ")
              .map(
                (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
              )
              .join(" + ")
          : "",
      })),
    [languages],
  );

  const [micPermissionState, setMicPermissionState] = useState<
  "checking" | "granted" | "denied" | "prompt" | "error"
>("checking");

  const [showMicError, setShowMicError] = useState(false);
  const [micErrorMessage, setMicErrorMessage] = useState("");

  // Feature flags
  const hasCustomTemplates = useFeature(FeatureKeys.CUSTOM_TEMPLATES);
  const hasMultiLanguageSupport = useFeature(
    FeatureKeys.MULTI_LANGUAGE_SUPPORT,
  );

  const validationSchema = Yup.object({
    mrn: Yup.string().required(
      isDubaiRegion ? "URN is required" : "MRN is required",
    ),
    episode_id: isDubaiRegion
      ? Yup.string().required("Episode ID is required")
      : Yup.string(),
    department: hasCustomTemplates
      ? Yup.string().required("Template is required")
      : Yup.string(),
    language: hasMultiLanguageSupport
      ? Yup.string().required("Language is required")
      : Yup.string(),
    termsAccepted: Yup.boolean()
      .required("This confirmation is required to proceed.")
      .oneOf([true], "This confirmation is required to proceed."),
  });

  const formik = useFormik({
    initialValues: {
      mrn: "",
      episode_id: "",
      department: hasCustomTemplates ? "" : "ED", // Default to ED if feature disabled
      language: hasMultiLanguageSupport ? "" : "english", // Default to english if feature disabled
      termsAccepted: false,
    },
    validationSchema,
    onSubmit: async (values) => {
      const permissionGranted = await checkAndRequestMicrophonePermission();
      if (!permissionGranted) {
        return;
      }

      setSessionData(
        buildSessionPayload(values, {
          hasCustomTemplates,
          hasMultiLanguageSupport,
          templateNameOptions: templateNameOptions || [],
          languageOptions: languageOptions || [],
          audioInputDeviceId: getPreferredMicDeviceId(),
        }),
      );
      onStart();
    },
  });

  const checkMicrophonePermission = async (): Promise<
    "granted" | "denied" | "prompt" | "error"
  > => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        return permissionStatus.state as "granted" | "denied" | "prompt";
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          return "granted";
        } catch {
          return "denied";
        }
      }
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      return "error";
    }
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error: unknown) {
      console.error("Error requesting microphone permission:", error);
      const err = error as { name?: string };

      if (err.name === "NotAllowedError") {
        setMicErrorMessage(
          "Microphone access was denied. Please allow microphone access in your browser settings",
        );
      } else if (err.name === "NotFoundError") {
        setMicErrorMessage(
          "No microphone found. Please connect a microphone and try again.",
        );
      } else if (err.name === "NotReadableError") {
        setMicErrorMessage(
          "Microphone is being used by another application. Please close other applications using the microphone and try again.",
        );
      } else {
        setMicErrorMessage(
          "Failed to access microphone. Please check your browser settings and try again.",
        );
      }

      return false;
    }
  };

  const checkAndRequestMicrophonePermission = async (): Promise<boolean> => {
    setShowMicError(false);

    try {
      const currentPermission = await checkMicrophonePermission();

      switch (currentPermission) {
        case "granted":
          return true;

        case "prompt":
        case "denied": {
          const granted = await requestMicrophonePermission();
          if (granted) {
            return true;
          }
          setShowMicError(true);
          return false;
        }

        case "error":
        default: {
          const grantedFallback = await requestMicrophonePermission();
          if (grantedFallback) {
            return true;
          }
          setShowMicError(true);
          return false;
        }
      }
    } catch (error) {
      console.error("Error in checkAndRequestMicrophonePermission:", error);
      setMicErrorMessage(
        "An unexpected error occurred while checking microphone permissions. Please refresh the page and try again.",
      );
      setShowMicError(true);
      return false;
    }
  };

  const retryMicrophonePermission = async () => {
    setShowMicError(false);
    await checkAndRequestMicrophonePermission();
  };

  useEffect(() => {
    if (!isDubaiRegion) {
      return;
    }

    const initializeMicrophoneCheck = async () => {
      const permission = await checkMicrophonePermission();
      setMicPermissionState(permission);
    };

    initializeMicrophoneCheck();
  }, []);

  useEffect(() => {
    const hospitalParams = getHospitalParamsFromUrl();

    if (hospitalParams.mrn) {
      formik.setFieldValue("mrn", hospitalParams.mrn);
    }

    if (isDubaiRegion && hospitalParams.encounterId) {
      formik.setFieldValue("episode_id", hospitalParams.encounterId);
    }

    // Handle template/department
    if (hasCustomTemplates) {
      // Wait until templates have loaded before resolving the param against
      // the option list — otherwise we'd overwrite it with "" and the effect
      // would never re-run to fix it.
      if (hospitalParams.template && templateNameOptions.length > 0) {
        const paramTemplate = hospitalParams.template.toLowerCase();
        const validTemplate = templateNameOptions.find(
          (opt) =>
            opt.value?.toLowerCase() === paramTemplate ||
            opt.label?.toLowerCase() === paramTemplate,
        );
        formik.setFieldValue("department", validTemplate?.value || "");
      }
    } else {
      formik.setFieldValue("department", "ED");
    }

    if (hasMultiLanguageSupport) {
      if (hospitalParams.language && languageOptions.length > 0) {
        const paramLanguage = hospitalParams.language.toLowerCase();
        const validLanguage = languageOptions.find(
          (opt) =>
            opt.value?.toLowerCase() === paramLanguage ||
            opt.label?.toLowerCase() === paramLanguage,
        );
        formik.setFieldValue("language", validLanguage?.value || "english");
      } else if (!hospitalParams.language && preferredLanguage && languageOptions.length > 0) {
        const validLanguage = languageOptions.find(
          (opt) =>
            opt.value === preferredLanguage.toLowerCase() ||
            opt.label.toLowerCase() === preferredLanguage.toLowerCase(),
        );
        formik.setFieldValue("language", validLanguage?.value || "english");
      } else if (!hospitalParams.language && !preferredLanguage && !formik.values.language) {
        formik.setFieldValue("language", "english");
      }
    } else {
      formik.setFieldValue("language", "english");
    }
  }, [
    hasCustomTemplates,
    hasMultiLanguageSupport,
    preferredLanguage,
    templateNameOptions,
    languageOptions,
  ]);

  const handleButtonClick = () => {
    if (showMicError) {
      retryMicrophonePermission();
    } else {
      formik.handleSubmit();
    }
  };

  return (
    <Modal className="w-full bg-white sm:rounded-lg" onClose={onClose}>
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <p className="text-center text-xl text-primary-300 sm:text-2xl md:font-medium">
          Start your new Recording
        </p>

        <Input
          className="w-full rounded-lg border border-gray-300 py-2 text-sm text-secondary-100 sm:py-3 sm:text-base"
          placeholder={isDubaiRegion ? "URN" : "MRN"}
          name="mrn"
          value={formik.values.mrn}
          onChange={formik.handleChange}
          id="mrn"
          required={true}
        />
        {formik.touched.mrn && formik.errors.mrn ? (
          <div className="mt-[-15px] w-full text-left text-xs text-red-500">
            {formik.errors.mrn}
          </div>
        ) : null}

        {isDubaiRegion ? (
          <>
            <Input
              className="w-full rounded-lg border border-gray-300 py-2 text-sm text-secondary-100 sm:py-3 sm:text-base"
              placeholder="Episode ID"
              name="episode_id"
              value={formik.values.episode_id}
              onChange={formik.handleChange}
              id="episode_id"
              required={true}
            />
            {formik.touched.episode_id && formik.errors.episode_id ? (
              <div className="mt-[-15px] w-full text-left text-xs text-red-500">
                {formik.errors.episode_id}
              </div>
            ) : null}
          </>
        ) : null}

        {hasCustomTemplates && (
          <>
            <Select
              options={templateNameOptions || []}
              value={formik.values.department}
              onChange={(e) =>
                formik.setFieldValue("department", e.target.value)
              }
              placeholder={
                templatesLoading ? "Loading templates..." : "Template"
              }
              className="w-full rounded-lg border-2 p-3 text-sm text-secondary-100 sm:p-4 sm:text-base"
              disabled={templatesLoading}
            />
            {formik.touched.department && formik.errors.department ? (
              <div className="mt-[-15px] w-full text-left text-xs text-red-500">
                {formik.errors.department}
              </div>
            ) : null}
          </>
        )}

        {hasMultiLanguageSupport && (
          <>
            <Select
              options={languageOptions || []}
              value={formik.values.language}
              onChange={(e) => formik.setFieldValue("language", e.target.value)}
              placeholder={languagesLoading ? "Loading..." : "Language"}
              className="w-full rounded-lg border-2 p-3 text-sm text-secondary-100 sm:p-4 sm:text-base"
              disabled={languagesLoading}
            />
            {formik.touched.language && formik.errors.language ? (
              <div className="mt-[-15px] w-full text-left text-xs text-red-500">
                {formik.errors.language}
              </div>
            ) : null}
          </>
        )}

        <div className="flex w-full items-start gap-2 sm:gap-3">
          <div className="relative mt-1">
            <input
              type="checkbox"
              id="termsAccepted"
              name="termsAccepted"
              checked={formik.values.termsAccepted}
              onChange={formik.handleChange}
              className="h-5 w-5 cursor-pointer appearance-none rounded border border-[#2F81FF] text-[#2F81FF] checked:bg-[#2F81FF] focus:ring-[#2F81FF]"
              style={{
                accentColor: "#2F81FF",
                outline: "none",
              }}
            />
            {formik.values.termsAccepted && (
              <div className="pointer-events-none absolute left-[3px] top-[2px]">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
          <label
            htmlFor="termsAccepted"
            className="cursor-pointer text-xs text-secondary-100 md:text-sm"
          >
            {isDubaiRegion
              ? "Please ensure that you have entered the correct URN and Episode ID and continue using the language selected for this session."
              : "Please ensure that you have entered the correct MRN and continue using the language selected for this session."}
          </label>
        </div>
        {formik.touched.termsAccepted && formik.errors.termsAccepted ? (
          <div className="mt-[-15px] w-full text-left text-xs text-red-500">
            {formik.errors.termsAccepted}
          </div>
        ) : null}

        {isDubaiRegion && micPermissionState === "checking" && (
          <div className="w-full rounded-lg bg-blue-50 p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm text-blue-600">
                Checking microphone access...
              </span>
            </div>
          </div>
        )}

        {showMicError && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Microphone Access Required
                </h3>
                <p className="mt-1 text-xs text-red-700">
                  {micErrorMessage ||
                    "Microphone access is required to start recording. Please allow microphone access and try again."}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleButtonClick}
          className="flex w-full min-h-[48px] items-center justify-center rounded-lg bg-[#2832A8] px-3 py-3 text-base font-semibold text-white shadow-lg hover:bg-[#1f2890] sm:px-4 sm:text-lg"
        >
          {showMicError ? "Retry microphone" : "Start Recording"}
        </button>
      </div>
    </Modal>
  );
};

export default RecordingDetailModal;
