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
export declare function getAvailableSlots(doctorApolloId: string, dateFrom: string): Promise<ApolloSlot[]>;
export declare function bookSlot(slotId: string, patientDetails: {
    name: string;
    phone: string;
    dob?: string;
    cancerType?: string;
}): Promise<ApolloBookingResult>;
export declare function cancelBooking(bookingId: string): Promise<void>;
