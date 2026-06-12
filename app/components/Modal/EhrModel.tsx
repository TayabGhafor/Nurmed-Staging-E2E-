"use client";

import Modal from ".";
import Select from "../Select";
import Input from "../input";
import { SaveEHRICon } from "../svgs";
import { useEffect, useLayoutEffect, useState } from "react";
import ConfirmSendEhr from "./ConfirmSendEhr";
import RpaNoteModal from "./RpaNoteModal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { SendToEhrRequest } from "../../kyClient/dashboard";
import { Patient } from "../../(pages)/(dashboard)/interfaces";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

interface EhrModelProps {
  onClose: () => void;
  patient: Patient | null;
  // fetchAndTransformTranscription: (sessionId: number) => void;
  fetchAndTransformNotes: (sessionId: number) => void;
}

interface FormValues {
  ehrSystem: string;
  encounter_id: string;
  vdr_id: string;
}

const RPA_NOTES_PREVIEW_HOSPITAL_ID = Number(
  process.env.NEXT_PUBLIC_EVERCARE_LAHORE_HOSPITAL_ID,
);

/** Hospital deep-link sessions store encounter + doctor IDs on `hospital_data`; skip the ID entry step when both are present. */
function getHospitalLinkedEhrIds(patient: Patient | null): {
  encounter_id: string;
  vdr_id: string;
} | null {
  if (!patient?.mrn) return null;
  const enc = patient.hospital_data?.encounterId?.trim();
  const doc = patient.hospital_data?.doctorId?.trim();
  if (!enc || !doc) return null;
  return { encounter_id: enc, vdr_id: doc };
}

function resolveLoggedInHospitalId(userHospitalId?: number): number | null {
  if (typeof userHospitalId === "number" && !isNaN(userHospitalId)) {
    return userHospitalId;
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const candidate = parsed?.hospital_id;
    const asNumber =
      typeof candidate === "number"
        ? candidate
        : typeof candidate === "string"
          ? Number(candidate)
          : NaN;
    return !isNaN(asNumber) ? asNumber : null;
  } catch {
    return null;
  }
}

const EhrModel = ({
  onClose,
  patient,
  // fetchAndTransformTranscription,
  fetchAndTransformNotes,
}: EhrModelProps) => {
  console.log("patient:", patient);
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggedInHospitalId, setLoggedInHospitalId] = useState<number | null>(
    null,
  );
  const [loggedInHospitalName, setLoggedInHospitalName] = useState<string>("");
  const [isHospitalLoading, setIsHospitalLoading] = useState(false);
  const [sendToEhrRequest, setSendToEhrRequest] = useState<SendToEhrRequest>({
    hospital: "",
    mrn: "",
    encounter_id: "",
    vdr_id: "",
  });

  useEffect(() => {
    setLoggedInHospitalId(resolveLoggedInHospitalId(user?.hospital_id));
  }, [user?.hospital_id]);

  useEffect(() => {
    let cancelled = false;

    const fetchHospitalName = async () => {
      if (!loggedInHospitalId) {
        setLoggedInHospitalName("");
        return;
      }

      setIsHospitalLoading(true);
      try {
        const { data, error } = await supabase
          .from("hospital")
          .select("name")
          .eq("id", loggedInHospitalId)
          .single();

        if (error) throw error;

        if (!cancelled) {
          const name = (data as any)?.name || "";
          setLoggedInHospitalName(name);
        }
      } catch (err) {
        console.error("Failed to fetch hospital name:", err);
        if (!cancelled) setLoggedInHospitalName("");
      } finally {
        if (!cancelled) setIsHospitalLoading(false);
      }
    };

    fetchHospitalName();
    return () => {
      cancelled = true;
    };
  }, [loggedInHospitalId]);

  const validationSchema = Yup.object({
    ehrSystem: Yup.string().required("EHR System is required"),
    encounter_id: Yup.string().when("ehrSystem", {
      is: "ever_care",
      then: (schema) => schema.required("Encounter ID is required"),
      otherwise: (schema) => schema,
    }),
    vdr_id: Yup.string().when("ehrSystem", {
      is: "ever_care",
      then: (schema) => schema.required("Doctor ID is required"),
      otherwise: (schema) => schema,
    }),
  });

  const formik = useFormik({
    initialValues: {
      ehrSystem: "ever_care",
      encounter_id: "",
      vdr_id: "",
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: (values: FormValues) => {
      if (patient?.mrn) {
        setSendToEhrRequest({
          hospital: values.ehrSystem,
          mrn: patient?.mrn,
          vdr_id: values.vdr_id,
          encounter_id: values.encounter_id,
        });
      }
      setShowConfirm(true);
    },
  });

  // Deep-link / hospital URL: both IDs already on the session — go straight to review (ConfirmSendEhr / RpaNoteModal).
  useLayoutEffect(() => {
    const ids = getHospitalLinkedEhrIds(patient);
    if (!ids || !patient?.mrn) return;
    setSendToEhrRequest({
      hospital: "ever_care",
      mrn: patient.mrn,
      encounter_id: ids.encounter_id,
      vdr_id: ids.vdr_id,
    });
    setShowConfirm(true);
  }, [
    patient?.id,
    patient?.mrn,
    patient?.hospital_data?.encounterId,
    patient?.hospital_data?.doctorId,
  ]);

  // Auto-populate only encounter_id and doctor_id from hospital_data
  useEffect(() => {
    if (patient?.hospital_data) {
      const hospitalData = patient.hospital_data;

      // Only populate encounter_id if available
      if (hospitalData.encounterId) {
        formik.setFieldValue("encounter_id", hospitalData.encounterId);
      }

      // Only populate doctor_id (vdr_id) if available
      if (hospitalData.doctorId) {
        formik.setFieldValue("vdr_id", hospitalData.doctorId);
      }
    }
  }, [patient?.hospital_data]);

  // Check if fields are pre-populated from database
  const isEncounterIdFromDb = patient?.hospital_data?.encounterId;
  const isDoctorIdFromDb = patient?.hospital_data?.doctorId;

  const isEvercareSelected = formik.values.ehrSystem === "ever_care";
  const isFormValid =
    !isEvercareSelected ||
    (isEvercareSelected &&
      formik.values.encounter_id !== "" &&
      formik.values.vdr_id !== "");

  const useRpaNotesPreviewBeforeSend =
    resolveLoggedInHospitalId(user?.hospital_id) ===
    RPA_NOTES_PREVIEW_HOSPITAL_ID;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formik.handleSubmit(e);
  };

  useEffect(() => {
    console.log("sendToEhrRequest:", sendToEhrRequest);
  }, [sendToEhrRequest]);

  return (
    <>
      {!showConfirm ? (
        <Modal className="w-full bg-white sm:rounded-lg" onClose={onClose}>
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
            <SaveEHRICon />
            <h3 className="text-center text-[20px]">
              Send Data to{" "}
              {isHospitalLoading ? "Loading..." : loggedInHospitalName || "—"}
            </h3>
            {/* <div className="text-center text-sm text-gray-600">
              Hospital:{" "}
              <span className="font-medium text-gray-800">
                {isHospitalLoading ? "Loading..." : loggedInHospitalName || "—"}
              </span>
            </div> */}
            <form onSubmit={handleSubmit} className="w-full max-w-md">
              <div className="flex w-full flex-col gap-4">
                {/* <Select
                  options={[{ value: "ever_care", label: "EverCare Lahore" }]}
                  value={formik.values.ehrSystem}
                  onChange={(e) => {
                    formik.setFieldValue("ehrSystem", e.target.value);
                    if (e.target.value !== "ever_care") {
                      formik.setFieldValue("encounter_id", "");
                      formik.setFieldValue("vdr_id", "");
                    }
                  }}
                  placeholder="Select EHR System"
                  className="mx-auto w-full rounded-lg border-2 p-3 text-sm text-secondary-100 sm:p-4 sm:text-base"
                  disabled={false}
                />
                {formik.touched.ehrSystem && formik.errors.ehrSystem ? (
                  <div className="text-sm text-red-500">
                    {formik.errors.ehrSystem}
                  </div>
                ) : null} */}

                {isEvercareSelected && (
                  <>
                    <div className="w-full">
                      <Input
                        // type="number"
                        name="encounter_id"
                        id="encounter_id"
                        placeholder="Enter Encounter ID"
                        value={formik.values.encounter_id}
                        onChange={formik.handleChange}
                        disabled={!!isEncounterIdFromDb}
                        className={`w-full border-2 p-3 text-sm sm:text-base ${
                          isEncounterIdFromDb
                            ? "bg-white text-secondary-100"
                            : ""
                        }`}
                      />
                      {formik.touched.encounter_id &&
                      formik.errors.encounter_id ? (
                        <div className="text-sm text-red-500">
                          {formik.errors.encounter_id}
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full">
                      <Input
                        // type="number"
                        name="vdr_id"
                        id="vdr_id"
                        placeholder="Enter Doctor ID"
                        value={formik.values.vdr_id}
                        onChange={formik.handleChange}
                        disabled={!!isDoctorIdFromDb}
                        className={`w-full border-2 p-3 text-sm sm:text-base ${
                          isDoctorIdFromDb ? "bg-white text-secondary-100" : ""
                        }`}
                      />
                      {formik.touched.vdr_id && formik.errors.vdr_id ? (
                        <div className="text-sm text-red-500">
                          {formik.errors.vdr_id}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}

                <div className="mt-4 flex w-full items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex w-24 items-center justify-center rounded-lg bg-primary-100 py-2 text-[12px] text-white shadow-sm"
                  >
                    No, Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className={`flex w-24 items-center justify-center rounded-lg py-2 text-[12px] text-white shadow-sm ${
                      isFormValid
                        ? "bg-primary-dark"
                        : "cursor-not-allowed bg-gray-400"
                    }`}
                  >
                    Yes, Send
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Modal>
      ) : useRpaNotesPreviewBeforeSend ? (
        <RpaNoteModal
          patient={patient}
          sendToEhrRequest={sendToEhrRequest}
          fetchAndTransformNotes={fetchAndTransformNotes}
          onClose={() => {
            setShowConfirm(false);
            onClose();
          }}
        />
      ) : (
        <ConfirmSendEhr
          sendToEhrRequest={sendToEhrRequest}
          sessionId={patient?.id}
          fetchAndTransformNotes={fetchAndTransformNotes}
          // fetchAndTransformTranscription={fetchAndTransformTranscription}
          onClose={() => {
            setShowConfirm(false);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default EhrModel;
