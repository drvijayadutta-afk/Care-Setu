"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSlots = getAvailableSlots;
exports.bookSlot = bookSlot;
exports.cancelBooking = cancelBooking;
const axios_1 = __importDefault(require("axios"));
const BASE = process.env.APOLLO_API_BASE || "https://api.apollohospitals.com/v1";
const apolloClient = axios_1.default.create({
    baseURL: BASE,
    headers: { "X-API-Key": process.env.APOLLO_API_KEY },
});
async function getAvailableSlots(doctorApolloId, dateFrom) {
    const { data } = await apolloClient.get(`/doctor/${doctorApolloId}/availability`, {
        params: { date: dateFrom, speciality: "oncology" },
    });
    return data.availableSlots || [];
}
async function bookSlot(slotId, patientDetails) {
    const { data } = await apolloClient.post("/appointments", {
        slotId,
        patientName: patientDetails.name,
        patientMobile: patientDetails.phone,
        patientDOB: patientDetails.dob,
        remarks: patientDetails.cancerType ? `Oncology - ${patientDetails.cancerType}` : "Oncology",
    });
    return data;
}
async function cancelBooking(bookingId) {
    await apolloClient.delete(`/appointments/${bookingId}`);
}
//# sourceMappingURL=apollo.js.map