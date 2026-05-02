import axios from "axios";

const BASE = process.env.APOLLO_API_BASE || "https://api.apollohospitals.com/v1";

const apolloClient = axios.create({
  baseURL: BASE,
  headers: { "X-API-Key": process.env.APOLLO_API_KEY },
});

export interface ApolloSlot {
  slotId: string;
  date: string;
  time: string;
  doctorName: string;
  facility: string;
  department: string;
}

export interface ApolloBookingResult {
  bookingId: string;
  uhid?: string;
  appointmentDate: string;
  appointmentTime: string;
  department: string;
  facility: string;
}

export async function getAvailableSlots(
  doctorApolloId: string,
  dateFrom: string
): Promise<ApolloSlot[]> {
  const { data } = await apolloClient.get(`/doctor/${doctorApolloId}/availability`, {
    params: { date: dateFrom, speciality: "oncology" },
  });
  return data.availableSlots || [];
}

export async function bookSlot(
  slotId: string,
  patientDetails: {
    name: string;
    phone: string;
    dob?: string;
    cancerType?: string;
  }
): Promise<ApolloBookingResult> {
  const { data } = await apolloClient.post("/appointments", {
    slotId,
    patientName: patientDetails.name,
    patientMobile: patientDetails.phone,
    patientDOB: patientDetails.dob,
    remarks: patientDetails.cancerType ? `Oncology - ${patientDetails.cancerType}` : "Oncology",
  });
  return data;
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await apolloClient.delete(`/appointments/${bookingId}`);
}
