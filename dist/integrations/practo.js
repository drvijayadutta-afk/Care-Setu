"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSlots = getAvailableSlots;
exports.bookSlot = bookSlot;
exports.cancelBooking = cancelBooking;
const axios_1 = __importDefault(require("axios"));
const BASE = process.env.PRACTO_API_BASE || "https://api.practo.com/v1";
let accessToken = null;
let tokenExpiry = 0;
async function getToken() {
    if (accessToken && Date.now() < tokenExpiry)
        return accessToken;
    const { data } = await axios_1.default.post(`${BASE}/oauth/token`, {
        grant_type: "client_credentials",
        client_id: process.env.PRACTO_CLIENT_ID,
        client_secret: process.env.PRACTO_CLIENT_SECRET,
    });
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return accessToken;
}
function practoClient() {
    return axios_1.default.create({
        baseURL: BASE,
        headers: { Authorization: `Bearer ${accessToken}` },
    });
}
async function getAvailableSlots(doctorPractoId, dateFrom, dateTo) {
    await getToken();
    const { data } = await practoClient().get(`/doctors/${doctorPractoId}/slots`, {
        params: { from: dateFrom, to: dateTo, consultation_type: "in_clinic" },
    });
    return data.slots || [];
}
async function bookSlot(slotId, patientDetails) {
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
async function cancelBooking(bookingId) {
    await getToken();
    await practoClient().delete(`/appointments/${bookingId}`);
}
//# sourceMappingURL=practo.js.map