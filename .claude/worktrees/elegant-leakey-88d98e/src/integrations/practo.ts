import axios from "axios";

const BASE = process.env.PRACTO_API_BASE || "https://api.practo.com/v1";

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const { data } = await axios.post(`${BASE}/oauth/token`, {
    grant_type: "client_credentials",
    client_id: process.env.PRACTO_CLIENT_ID,
    client_secret: process.env.PRACTO_CLIENT_SECRET,
  });

  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
}

function practoClient() {
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export interface PractoSlot {
  slotId: string;
  date: string;
  time: string;
  doctorName: string;
  hospitalName: string;
  consultationType: string;
}

export interface PractoBookingResult {
  bookingId: string;
  confirmationNumber: string;
  appointmentDetails: {
    date: string;
    time: string;
    doctorName: string;
    hospitalName: string;
    floor?: string;
    department?: string;
  };
}

export async function getAvailableSlots(
  doctorPractoId: string,
  dateFrom: string,
  dateTo: string
): Promise<PractoSlot[]> {
  await getToken();
  const { data } = await practoClient().get(`/doctors/${doctorPractoId}/slots`, {
    params: { from: dateFrom, to: dateTo, consultation_type: "in_clinic" },
  });
  return data.slots || [];
}

export async function bookSlot(
  slotId: string,
  patientDetails: {
    name: string;
    phone: string;
    cancerType?: string;
  }
): Promise<PractoBookingResult> {
  await getToken();
  const { data } = await practoClient().post("/appointments/book", {
    slot_id: slotId,
    patient: {
      name: patientDetails.name,
      phone: patientDetails.phone,
      notes: patientDetails.cancerType ? `Cancer type: ${patientDetails.cancerType}` : undefined,
    },
  });
  return data;
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await getToken();
  await practoClient().delete(`/appointments/${bookingId}`);
}
