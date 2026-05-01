import { Worker } from "bullmq";
export declare const checkinWorker: Worker<any, any, string>;
export declare const appointmentWorker: Worker<any, any, string>;
export declare const doctorSignalWorker: Worker<any, void, string>;
export declare function gracefulShutdown(): Promise<[void, void, void]>;
