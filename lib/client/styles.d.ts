/**
 * Global stylesheet adoption: the export dropdown chrome, the header action
 * button, and the failure toast. Injected once into document.head with a
 * stable id so repeated plugin loads never double-inject.
 */
/**
 * Inject the stylesheet once. Safe to call from multiple mount paths.
 */
export declare function adoptStyles(): void;
