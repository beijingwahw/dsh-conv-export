//#region src/invariant.ts
/**
* Package-owned invariant companion: reserves the plugin's ownership marker
* so the harness invariant registry can attribute the browser bundle to this
* package. Mirrors the shape every dsh-external plugin ships.
*/
/** The invariant marker this package owns. */
const INVARIANT_ID = "@dsh-external/dsh-conv-export";
/**
* The invariant record registered with the harness diagnostics registry.
* @returns a stable marker object (identity-free; compared by id).
*/
function invariant() {
	return {
		id: INVARIANT_ID,
		kind: "plugin"
	};
}
//#endregion
export { INVARIANT_ID, invariant };
