import { Status } from "../../kyClient/dashboard";

export interface Patient {
  id: string;
  mrn: string;
  episode_id?: string;
  department: string;
  language: string;
  name: string;
  status: Status;
  sessionDurationMinutes?: string;
  sessionDurationSeconds?: string;
  dateOfBirth: string;
  date: string;
  time?: string; // Time in HH:MM format
  created_at?: string; // ISO format: YYYY-MM-DDTHH:MM:SS.ssssss
  hospital_data?: {
    encounterId?: string;
    doctorId?: string;
    mrn?: string;
    template?: string;
    language?: string;
    new?: string;
  };
  // Offline session properties
  isOffline?: boolean;
  retryUpload?: () => Promise<void>;
  recording?: Blob;
  tempId?: string; // For optimistic sessions
  /** EHR/scribe pipeline status from the API (numeric or string) */
  ehr_status?: string | number | null;
  /** Present when send-to-EHR queued a scribe job */
  ehr_response?: { scribe_job_queued?: boolean } | null;
}

export interface Medication {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
}

export interface Message {
  id: string;
  sender: "Patient" | "Doctor";
  content: string;
  timestamp: string;
}

export interface AudioRecording {
  id: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export type TabType = "examinations" | "conversations";

export interface PatientDetails extends Patient {
  age?: number;
  gender?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phoneNumber: string;
  };
}

export interface Examination {
  id: string;
  patientId: string;
  date: string;
  type: string;
  notes: string;
  diagnosis?: string;
  prescriptions?: string[];
  attachments?: {
    id: string;
    type: "image" | "document" | "audio";
    url: string;
    name: string;
  }[];
}

export interface DoctorProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  specialization?: string;
  imageUrl?: string;
}
