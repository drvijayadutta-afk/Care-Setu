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
export declare function getAvailableSlots(doctorPractoId: string, dateFrom: string, dateTo: string): Promise<PractoSlot[]>;
export declare function bookSlot(slotId: string, patientDetails: {
    name: string;
    phone: string;
    cancerType?: string;
}): Promise<PractoBookingResult>;
export declare function cancelBooking(bookingId: string): Promise<void>;
