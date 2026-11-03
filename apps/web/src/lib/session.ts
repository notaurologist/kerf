import { createContext } from 'react';

/**
 * How many times the session has come back after ending, through Log in again. A screen whose
 * load was refused for want of a session loads again when this changes (`useLoad`).
 */
export const SessionReturns = createContext(0);
